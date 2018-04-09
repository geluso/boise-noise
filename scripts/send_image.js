require('dotenv').config();

const Twilio = require('twilio');
const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const MessagingResponse = Twilio.twiml.MessagingResponse;

client.messages
.create({
  to: '+15095541122',
  from: process.env.TWILIO_NUMBER,
  body: 'here i am',
  mediaUrl: 'http://5tephen.com/img/me.jpg'
})
