"use strict";

// Using node-mysql
var mysql = require("mysql");

var fs = require("fs");

var async = require("async");

var moment = require('moment');

// Using socket.io
var app = require("http").createServer(handler);
var io = require("socket.io")(app);

var crypto = require("crypto");

app.listen(7777, function() {
	console.log('Chat service was listening at port *:7777');
})

function handler (req, res) {
	fs.readFile(__dirname + "/index.html", 
		function(err, data) {
			res.writeHead(200);
			res.end(data);
	});
}

// Loading config mysql
var configMysql = require("./config.json");

var connections = mysql.createConnection(configMysql);

connections.connect(function(err) {
	if (err) {
		console.log("Error: " + err.stack);
	} else {
		console.log("Connect to mysql successeful as id " + connections.threadId);
	};
});


io.on('connection', function(socket){
	// console.log(socket.id + ' has connected');

	var id = crypto.randomBytes(20).toString('hex');

	socket.emit('welcome', {message: "Welcome " + id, id: socket.id});

	socket.on('uid', function(data) {


		connections.query("select userID from chat_users where userID=" + data.current_id, function(err, res) {
			if (err) {
				console.log(err);
			} else {
				if (res.length == 0) {
					connections.query(`insert into chat_users (userID, socketID, username, status, avt) values ('${data.current_id}', '${data.sid}' ,'${data.username}', 'online', '${data.avt}')`, function(e, r) {
						if (e) {
							console.log(e);
						} else {
							console.log(r);
						};
					});
				} else {
					connections.query(`update chat_users set status='online', socketID='${data.sid}' where userID=${data.current_id}`, function(e, r) {
						if (e) {
							console.log(e);
						} else {
							console.log('user '+ data.username +' is online');
						};
					})
				};
			};
		});

		socket.broadcast.emit('user_status', {
			uid: data.current_id,
			sid: data.sid
		});
	})

	socket.on('chat message', function(data){
		var touID = parseInt(data.touid);


		let tasks = [], auid, atuid;

		tasks.push(function(callback) {
			connections.query(`select meta_value from bb_usermeta where meta_key="user_avt" and user_id=${data.cid}`, function(err, res) {
				if (err) {
					console.log(err);
					callback(err);
				} else {
					if (res.length > 0) {
						auid = res[0].meta_value;
						callback();	
					} else {
						auid = "no_avt";
						callback();
					};
					

				};
			});	
		});

		tasks.push(function(callback) {
			connections.query(`select meta_value from bb_usermeta where meta_key="user_avt" and user_id=${touID}`, function(err, res) {
				if (err) {
					console.log(err);
					callback(err);
				} else {
					if (res.length > 0) {
						atuid = res[0].meta_value;
						callback();						
					} else {
						atuid = "no_avt";
						callback();
					};
				};
			});	
		});		


		tasks.push(function(callback) {

			connections.query(`select socketID from chat_users where userID=${touID}`, function(err, res) {

				// console.log(data);

				var now = moment().format('YYYY-MM-DD hh:mm:ss');

				

				if (res.length > 0) {
					socket.broadcast.to(res[0].socketID).emit('new message', data);

					connections.query(`insert into chat_messages (userID, toUserID, content, unread, dTime, avtUserID, avtToUserID) values (${data.cid}, ${touID}, "${data.message}", "true", "${now}", "${auid}", "${atuid}")`, function(e, r) {
						if (e) {
							console.log(e);
						} else {
							console.log(res);
						};
					});
					callback();
					
				} else {
					connections.query(`insert into chat_messages (userID, toUserID, content, unread, dTime, avtUserID, avtToUserID) values (${data.cid}, ${touID}, "${data.message}", "true", "${now}", "${auid}", "${atuid}")`, function(e, r) {
						if (e) {
							console.log(e);
						} else {
							console.log(res);
						};
					});
					callback();
				};
			});
		})

		async.series(tasks, function(err, res) {
			console.log('successeful');
		})


		

	});

	// 

	socket.on('disconnect', function(){ 
		connections.query(`update chat_users set status='offline', socketID='' where socketID='${socket.id}'`, function(e, r) {
			if (e) {
				console.log('Error: ' + e);
			} else {
				console.log('disconnect socket');
				socket.broadcast.emit('user_disconnect', {
					sid: socket.id
				});
			};
		});

	});
});



var createChatMess = connections.query('create table if not exists chat_messages (' +
				'id int(11) not null AUTO_INCREMENT, ' + 
				'userID int(11) not null,' +
                'toUserID int(11) not null, ' + 
                'content text not null,' +
                'unread VARCHAR(5) not null,' +
                'dTime datetime not null,' + 
                'avtUserID VARCHAR(100) not null,' +
                'avtToUserID VARCHAR(100) not null,' +
                'PRIMARY KEY(id))');

var createChatUsers = connections.query('create table if not exists chat_users (' +
				'id int(11) not null AUTO_INCREMENT, ' + 
				'userID int(11) not null,' +
				'socketID VARCHAR(100) not null,' +
                'username VARCHAR(20) not null,' +
                'status VARCHAR(10) not null,' +
                'avt VARCHAR(50) not null,' +
                'PRIMARY KEY(id))');

createChatMess
	.on('error', function(err) {
		console.log("Erro:" + err);
	})
	.on('result', function(result) {
		// print information after created table successeful
	})
	.on('end', function() {

	})

createChatUsers
	.on('error', function(err) {
		console.log("Erro:" + err);
	})
	.on('result', function(result) {
		// print information after created table successeful
	})
	.on('end', function() {

	})
