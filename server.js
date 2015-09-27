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

app.listen(7777, () => {
	console.log('Chat service was listening at port *:7777');
});

function handler (req, res) {
	fs.readFile(__dirname + "/index.html", 
		(err, data) => {
			res.writeHead(200);
			res.end(data);
	});
}

// Loading config mysql
var configMysql = require("./config.json");

var connections = mysql.createConnection(configMysql);

connections.connect((err) => {
	if (err) {
		console.log("Error: " + err.stack);
	} else {
		console.log("Connect to mysql successeful as id " + connections.threadId);
	};
});


io.on('connection', (socket) => {
	// console.log(socket.id + ' has connected');

	console.log(socket.id + 'is online');

	var id = crypto.randomBytes(20).toString('hex');

	socket.emit('welcome', {message: "Welcome " + id, id: socket.id});

	socket.on('uid', (data) => {

		// console.log(data);

		connections.query(`select roomId from chat_rooms where userID=${data.current_id}`, function(err, res) {
			if (err) {
				console.log(err);
			} else { 
				if (res.length > 0) {
					res.forEach((e) => {
						socket.join(e.roomId);
					})
				};
			};
		})

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
					});
				};
			};
		});

		console.log(data.current_id);

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


	socket.on('new room', function(data) {

		var roomId = crypto.randomBytes(20).toString('hex');

		var init_users_in_group = data.listUsers.split(',');
		init_users_in_group.push(data.cid);

		var listavt = [];

		init_users_in_group.forEach(function(elem, index) {

			connections.query(`insert into chat_rooms(roomId, userID) values ("${roomId}", ${elem})`, function(e, r) {
				if (e) {
					console.log(e);
				} else {
					console.log('create success a room with room id ' + roomId);
				};
			});

		});

		socket.emit('room created', {roomId: roomId});
	});

	socket.on('update room', function(data) {


		function difference(a1, a2) {
			var a2Set = new Set(a2);
	  		return a1.filter(function(x) { return !a2Set.has(x); });
		}

		function symmetric_difference(a1, a2) {
  			return difference(a1, a2).concat(difference(a2, a1));
		}


		var update_users = data.listUsers.split(',');
		var list_old_users = [];
		var tasks = [];

		tasks.push(function(callback) {
			connections.query(`select userID from chat_rooms where roomId='${data.roomId}'`, function(err, res) {
				if (err) {
					callback(err);
				} else {
					res.forEach(function(e) {
						list_old_users.push(e.userID);
					});
					callback();
				};
			});
		});

		async.series(tasks, function(err, res) {
			// console.log('oul-user -- ' + list_old_users);
			// console.log('new user -- ' + update_users);
			// console.log(difference(update_users, list_old_users));
			// console.log(difference([36, 34, 35, 33], [36, 34]));
		});

	})


	socket.on('group message', function(data) {

		console.log(data);

		connections.query(`select roomId from chat_rooms where userID=${data.cid} and roomId="${data.roomId}"`, function(e, r) {
			if (e) {
				console.log(e);
			} else {
				r.forEach(function(e) {
					io.to(e.roomId).emit('room:chat', {
						avt: data.avt,
						message: data.message						
					});
				});
			};
		});

		var nowg = moment().format('YYYY-MM-DD hh:mm:ss');
		

		var list_users_in_group = data.tolistusers.split(',');

		connections.query(`insert into chat_mess_rooms (roomId, userIDSent, socketID, content, avt, chatTime) values ("${data.roomId}", ${data.cid}, "${data.sid}", "${data.message}", "${data.avt}", "${nowg}")`, function(err, res) {
			if (err) {
				console.log(err);
			} else {
				console.log('save successeful');
			};
		});

	});

	socket.on('list user', function(data) {

		let lu = [];
		let tasks = [];

		tasks.push(function(cb) {

			connections.query(`select userID from chat_rooms where roomId="${data.roomId}"`, function(err, res) {
				if (err) {
					cb(err);
				} else {
					if (res.length > 0) {
						res.forEach(function(el) {
							lu.push(el.userID);
						})
						cb();
					} else {
						cb('not found');
					};
				};
			})	
		});

		async.series(tasks, function(e, r) {
			socket.emit('list:users', {list_users: lu});
		})
		
	})

	socket.on('list mess', function(data) {
		console.log(data);

		connections.query(`select * from chat_mess_rooms where roomId="${data.roomId}" order by chatTime ASC`, function(err, res) {
			if (err) {
				console.log(err);
			} else {
				socket.emit('list:mess', res);
			};
		})	
	})

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
                'PRIMARY KEY(id)) CHARACTER SET utf8 COLLATE utf8_general_ci;');

var createChatUsers = connections.query('create table if not exists chat_users (' +
				'id int(11) not null AUTO_INCREMENT, ' + 
				'userID int(11) not null,' +
				'socketID VARCHAR(100) not null,' +
                'username VARCHAR(20) not null,' +
                'status VARCHAR(10) not null,' +
                'avt VARCHAR(100) not null,' +
                'PRIMARY KEY(id)) CHARACTER SET utf8 COLLATE utf8_general_ci;');

var createChatRooms = connections.query('create table if not exists chat_rooms (' +
				'id int(11) not null AUTO_INCREMENT, ' + 
				'roomId VARCHAR(100) not null,' +
                'userID int(11) not null,' +
                'avt VARCHAR(100) null,' +
                'PRIMARY KEY(id)) CHARACTER SET utf8 COLLATE utf8_general_ci;');

var createMessRooms = connections.query('create table if not exists chat_mess_rooms (' +
				'id int(11) not null AUTO_INCREMENT, ' + 
				'roomId VARCHAR(100) not null,' +
                'userIDSent int(11) not null,' +
                'socketID VARCHAR(100) not null,' +
                'content text not null,' +
                'avt VARCHAR(100) not null,' +
                'chatTime datetime not null,' +
                'PRIMARY KEY(id)) CHARACTER SET utf8 COLLATE utf8_general_ci;') ;

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

createChatRooms
	.on('error', function(err) {
		console.log("Erro:" + err);
	})
	.on('result', function(result) {
		// print information after created table successeful
	})
	.on('end', function() {

	})

createMessRooms
	.on('error', function(err) {
		console.log("Erro:" + err);
	})
	.on('result', function(result) {
		// print information after created table successeful
	})
	.on('end', function() {

	})		
