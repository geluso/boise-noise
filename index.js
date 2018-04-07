require('dotenv').config();

const http = require('http');
const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);

const Contact = mongoose.model('Contact', {number: String});

const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/sms', (req, res) => {
  const twiml = new MessagingResponse();

  let number = req.body.From;
  console.log('got:', number, req.body.Body);

  Contact.find({number})
  .then(contact => {
    if (contact === null) {
      return Contact.create({number});
    }
    return contact;
  })
  .then(contact => {
    console.log('created:', contact);
    return Contact.find({});
  })
  .then(contacts => {
    contacts.forEach(contact => {
      console.log('contact:', contact.number);
      if (contact.number !== number) {
        console.log('send to:', contact.number);
        // client.messages
        // .create({
        //   to: contact.number,
        //   from: process.env.TWILIO_NUMBER,
        //   body: 'mass text',
        // })
        // .then(message => console.log(message.sid));
      }
    });
  })
  .catch(err => {
    res.status(500).send(err);
    return;
  });

  if (req.body.Body == 'hello') {
    twiml.message('hi!');
  } else if(req.body.Body == 'bye') {
    twiml.message('goodbye');
  } else {
    twiml.message('default response');
  }

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

app.get('*', (req, res) => {
  res.send('text (206) 900-9011');
});

const PORT = process.env.PORT;
http.createServer(app).listen(PORT, () => {
  console.log('Express server listening on port', PORT);
});
