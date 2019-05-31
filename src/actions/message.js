const { web } = require('../clients');

const { BOT_USERNAME } = require('../../config');

const Text = require('../text');

const openMentorRequest = (trigger_id) => {
  web.dialog.open({
    trigger_id,
    dialog: {
      callback_id: "mentor_request",
      title: "Request a Mentor",
      submit_label: "Request",
      notify_on_cancel: true,
      elements: [
        {
          "type": "text",
          "label": "Your Problem",
          "name": "problem"
        },
        {
          "type": "text",
          "label": "Your Location",
          "name": "location"
        }
      ]
    }
  })
    .catch(console.error);
};

const confirmMentorRequest = (channel) => {
  web.chat.postMessage({ 
    channel: channel,
    text: {
      type: "plain_text",
      text: Text.REQUEST_CONFIRM
    },
    blocks: [
      {
        type: "section",
        text: {
          type: "plain_text",
          text: Text.REQUEST_CONFIRM
        }
      },
      {
        type: "actions",
        elements: [
          {
            action_id: "cancel_request",
            type: "button",
            text: {
              type: "plain_text",
              text: Text.CANCEL_REQUEST_BUTTON
            }
          }
        ]
      }
    ],
    as_user: false, 
    username: BOT_USERNAME })
      .catch(console.error);
}

const welcome = (member) => {
  web.chat.postMessage({ 
    channel: event.channel,
    text: {
      type: "plain_text",
      text: Text.WELCOME(member)
    },
    blocks: [
      {
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": Text.WELCOME(member)
        }
      },
      {
        "type": "section",
        "text": {
          "type": "plain_text",
          "text": Text.NEED_MENTOR
        }
      },
      {
        "type": "actions",
        "elements": [
          {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": Text.NEED_MENTOR_BUTTON
            }
          }
        ]
      }
    ],
    as_user: false, 
    username: BOT_USERNAME })
      .catch(console.error);
}

module.exports = { welcome, openMentorRequest, confirmMentorRequest };