'use strict';

module.exports.hello = async event => {

  console.log(event);

  let intent = event.currentIntent;

  let response = {
    dialogAction: {
      type: 'Close',
      fulfillmentState: 'Failed',
      message: {
        contentType: 'PlainText',
        content: `something went wrong!`
      }
    }
  }

  if (intent && intent.name === 'Create_Service') {


    response = {
      dialogAction: {
        type: 'Close',
        fulfillmentState: 'Fulfilled',
        message: {
          contentType: 'PlainText',
          content: `Great! Generator (lambda) received your request. Creating service ${intent.slots.serviceName} with runtime ${intent.slots.runtime}`
        }
      }
    }
  }




  return response;
};
