require('dotenv').config();

const http = require('http');
const express = require('express');
const Twilio = require('twilio');
const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const MessagingResponse = Twilio.twiml.MessagingResponse;

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);

const Contact = mongoose.model('Contact', {
  number: String,
  username: {default: 'anon', type: String},
  channel: {default: 'lobby', type: String}
});

var messageSchema = new mongoose.Schema({text: String}, {timestamps: {createdAt: 'created_at'}});
const Message = mongoose.model('Message', messageSchema);

const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/sms', (req, res) => {
  let from = req.body.From;
  let msg = req.body.Body;

  if (msg.length < 6 && msg.toLowerCase().startsWith("help")) {
    help(from);
  } else if (msg.startsWith(".")) {
    configure(from, msg);
  } else {
    let imgUrl = null;
    console.log('received', req.body);
    if (req.body.MediaUrl0) {
      imgUrl = req.body.MediaUrl0;
    }

    broadcast(from, msg, imgUrl);
  }

  // send an empty response
  const twiml = new MessagingResponse();
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

function help(from) {
  let msg = 'welcome to Boise Noise. sounds of Boise, Udaho. send something and everyone else will get it.';
  let setUsername = 'reply ".setname somename" to set your username. sorry, no pics yet.';

  client.messages
  .create({
    to: from,
    from: process.env.TWILIO_NUMBER,
    body: msg
  })
  .then(message => {
    console.log(message.sid)
  })
  .then(() => {
    return client.messages
    .create({
      to: from,
      from: process.env.TWILIO_NUMBER,
      body: setUsername
    })
  });
}

function configure(number, msg) {
  let [command, ...rest] = msg.split(" ");
  rest = rest.join(" ");
  command = command.toLowerCase();

  console.log('config', command, number);
  if (command.startsWith(".name") || command.startsWith(".setname")) {
    setName(number, rest);
  } else if (command.startsWith(".roll") || command.startsWith(".dice")) {
    roll(number);
  } else if (command.startsWith(".spin")) {
    spinTheBottle(number);
  } else if (command.startsWith(".join")) {
    joinChannel(number, rest);
  } else if (command.startsWith(".list")) {
    listChannels(number);
  } else if (command.startsWith(".emote")) {
    emote(number, rest);
  } else if (command.startsWith(".whereami")) {
    // TODO
  } else if (command.startsWith(".whoami")) {
    // TODO
  }
}

function emote(number, text) {
  broadcast(number, text, null, true, text);
}

function listChannels(number) {
  Contact.find({})
  .then(contacts => {
    let channelCount = contacts.reduce((tally, user) => {
      if (tally[user.channel] === undefined) {
        tally[user.channel] = 0;
      }
      tally[user.channel]++;
      return tally;
    }, {});

    let msg = '';
    Object.entries(channelCount).forEach(entry => {
      let key = entry[0];
      let val = entry[1];
      msg += `(${val}) ${key}\n`;
    });

    msg = msg.trim();
  
    console.log('list:', msg);
    return
    client.messages
    .create({
      to: from,
      from: process.env.TWILIO_NUMBER,
      body: msg
    });
  });
}

function joinChannel(number, channelName) {
  Contact.findOne({number})
  .then(contact => {
    contact.channel = channelName;
    return contact.save();
  })
  .then(() => {
    let msg = 'you joined channel: ' + channelName;

    client.messages
    .create({
      to: number,
      from: process.env.TWILIO_NUMBER,
      body: msg
    });
  });
}

function spinTheBottle(number) {
  Contact.find({})
  .then(users => {
    // pick a random person
    let index = Math.floor(Math.random() * users.length);
    let choice = users[index];

    // see if it's themself
    let user = choice.username;
    if (choice.number === number) {
      user = 'themself!';
    }

    let actions = [
      'gets rejected by', 
      'pecks', 
      'kisses',
      'kisses',
      'kisses',
      'kisses',
      'giggles at',
      'massages',
      'deeply kisses',
      'makes out with',
      'slobbers all over',
      'goes full tongue with',
      'plays seven minutes in heaven with',
      'marries',
      'dates',
      'dumps',
    ];

    index = Math.floor(Math.random() * actions.length);
    action = actions[index];

    let msg = `and ${action} ${user}`;
    broadcast(number, msg, null, ".spins");
  });
}

function roll(number) {
  let roll = Math.floor(Math.random() * 9);
  let result = '' + roll;
  for (let i = 0; i < roll; i++) {
    result += '=';
  }
  result += 'D';
  broadcast(number, result, null, ".rolls");
}

function setName(number, arg) {
  // set someone's username
  // restrict it to the first 8 char
  let username = arg.substr(0, 8);

  Contact.findOne({number})
  .then(user => {
    user.username = username;
    return user.save();
  })
  .then(user => {
    return client.messages
    .create({
      to: number,
      from: process.env.TWILIO_NUMBER,
      body: `.name now= ${user.username}`
    })
  }); 
}

function broadcast(number, msg, imgUrl, legit, customMsg) {
  let sender = undefined;

  Contact.findOne({number})
  .then(contact => {
    if (contact === null) {
      help(number);
      let username = 'anon' + ('' + Math.random()).substr(2, 4);
      return Contact.create({number, username});
    }
    return contact;
  })
  .then(contact => {
    sender = contact;
    // limit contacts to people in the same channel
    return Contact.find({
      channel: sender.channel
    });
  })
  .then(contacts => {
    // format the message
    let body = `${sender.username}: ${msg}`;
    if (legit) {
      body = `${sender.username} ${legit}: ${msg}`;
    }

    if (customMsg) {
      body = `${sender.username} ${customMsg}`;
    }

    // log everything!
    Message.create({text: body});
    console.log('sending', body);

    contacts.forEach(contact => {
      // send it to everyone else, unless result of something legit
      if (legit || contact.number !== number) {
        params = {
          to: contact.number,
          from: process.env.TWILIO_NUMBER,
          body: body,
        };

        if (imgUrl) {
          params.mediaUrl = imgUrl;
        }

        console.log('send params', params);
        client.messages
        .create(params)
        .then(message => console.log(message.sid));
      }
    });
  })
  .catch(err => {
    console.log('error:', err);
    res.status(500).send(err);
  });
}

app.get('*', (req, res) => {
  res.write('<title>Boise Noise</title>');
  res.write('<h1>Boise Noise</h1>');
  res.write('<p>text (206) 900-9011</p>');
  res.end();
});

const PORT = process.env.PORT;
http.createServer(app).listen(PORT, () => {
  console.log('Express server listening on port', PORT);
});
