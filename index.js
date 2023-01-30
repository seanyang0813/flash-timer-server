const io = require("socket.io")(process.env.PORT || 3001, {
    cors: {
        origin: "*",
    },
});

var messages = 0;
const rooms = new Map();
var max_rooms = 10000;
const UPDATE_BUCKETS = 10;
let bucket_cycle = 0;
// check every 100 ms but sync evewery n seconds
setInterval(() => {
    rooms.forEach((value, key) => {
        rooms.set(
            key,
            value.map((timer) => {
                if (timer == null) {
                    return null;
                }
                let res = Math.max(timer - 10, 0);
                if (res == 0) {
                    return null;
                }
                return res;
            })
        );
    });
    // sync every n seconds depending on bucket modulus
    rooms.forEach((value, key) => {
        if (key % UPDATE_BUCKETS == bucket_cycle) {
            io.to(key).emit("sync", {
                timers: value,
            });
        }
    });

    bucket_cycle = (bucket_cycle + 1) % UPDATE_BUCKETS;
}, 1000);

io.on("connection", (socket) => {
    socket.on("join", function (room) {
        // if room is -1 then assign a random room number
        if (room == -1) {
            room = Math.floor(Math.random() * max_rooms);
            // make sure the room doesn't exist
            while (rooms.has(room)) {
                // expand room pool size
                max_rooms *= 10;
                room = Math.floor(Math.random() * max_rooms);
            }
            // send back the room number to the user
            socket.emit("room-number", {
                room: room,
            });
        }
        // if room does not exist, create it
        if (!rooms.has(room)) {
            rooms.set(room, [null, null, null, null, null]);
        }
        socket.join(room);
        console.log("joined room " + room);
        // send back a sync message to the joined user only
        socket.emit("sync", {
            timers: rooms.get(room),
        });
    });

    // payload has field room number and array of time size 5
    socket.on("update-flash", function (payload) {
        console.log(
            "updating room " + payload.room + " with " + payload.timers
        );
        rooms.set(payload.room, payload.timers);
        socket.to(payload.room).emit("sync", {
            timers: payload.timers,
        });
    });
});
