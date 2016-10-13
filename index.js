// if (!process.env.SLACK_TOKEN) {
//     console.log('Error: Specify token in environment');
//     process.exit(1);
// }

var Botkit = require('botkit');
var os = require('os');
var Moment = require('moment-timezone');
var BeepBoop = require('beepboop-botkit');

var config = {}
if (process.env.MONGOLAB_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({mongoUri: process.env.MONGOLAB_URI}),
    };
} else {
    config = {
        json_file_store: './db_slackbutton_slash_command/',
    };
}

config.debug = true;
config.logLevel = 7;
config.retry = Infinity;
config.interactive_replies = true;

var controller = Botkit.slackbot(config);

var beepboop = BeepBoop.start(controller, { debug: true });

controller.setupWebserver(process.env.PORT, function (err, webserver) {
    controller.createWebhookEndpoints(controller.webserver);
});


controller.hears(['help'], 'direct_message,direct_mention', function (bot, message) {
  bot.reply(message, "I am your Survey Bot :robot_face:" +
    "\nI can start a Survey on your command & update the channel by uploading a file when the survey finishes or when you request." +
    "\nOnly authorized members in every channel can start survey." +
    "\nCurrently only @ojas.gosar is authorized to start scrum (in order to avoid spam in public channels)." +
    "\n`coming soon - you can automate the process of creating & updating survey's`" +
    "\nTry `@survey_bot start` - to start a survey" +
    "\nTry `@survey_bot status` - to find out the result of the survey");
});

controller.hears(['start survey', 'start', 'survey'], 'direct_message,direct_mention,mention', function(bot, message) {
    
    if (message.user == 'U2K8XK03Z' || message.user == 'U23RT8WQ4') {
        //var users = [];
        bot.api.channels.info({
            channel: message.channel
        }, function(err, info) {
            if (err) {
                bot.botkit.log('Failed to get channel info :(', err);
                bot.reply(message,"I can't start survey outside of a channel or in a private channel." +
                    "\nIf you havent already invited me to a public channel then try `/invite @survey_bot`" +
                    "\nThen `@survey_bot start` to start a survey" +
                    "\nYou can also type `@survey_bot help` to find out what i can do for you..");
            }
            else {
                var date = Moment().format("YYYYMMDD");
                bot.reply(message,"Starting Survey now");
                for (var i = 0; i < info.channel.members.length; i++) {
                    console.log(info.channel.members[i]);
                    bot.api.users.info({
                        user: info.channel.members[i]
                    }, function(err, userInfo) {
                        if(userInfo.user.is_bot == false) {
                            console.log("user name:" + userInfo.user.name + " user id:" + userInfo.user.id + " is_bot:" + userInfo.user.is_bot);
                            bot.startPrivateConversation({user: userInfo.user.id}, function(response, convo) {
                                console.log(convo);
                                convo.ask({
                                    text: "How would you rate this BBL?",
                                    attachments:[
                                        {
                                            title: 'choose your feeling..',
                                            fallback: 'You are unable to choose the actions!',
                                            callback_id: 'rate_bbl',
                                            attachment_type: 'default',
                                            actions: [
                                                {
                                                    "name":"okay",
                                                    "text": "Okay",
                                                    "value": "it was okay",
                                                    "type": "button",
                                                },
                                                {
                                                    "name":"like",
                                                    "text": "Like",
                                                    "value": "i liked it",
                                                    "type": "button",
                                                },
                                                {
                                                    "name":"awesome",
                                                    "text": "Awesome",
                                                    "value": "it was awesome",
                                                    "type": "button",
                                                }
                                            ]
                                        }
                                    ]
                                },[
                                    {
                                        pattern: "it was okay",
                                        callback: function(reply, convo) {
                                            bot.replyInteractive(reply, fetchInteractiveReply("How would you rate this BBL?", "Okay: It was only :ok:..", "rate_bbl_okay"));
                                            //convo.say('it was only okay?');
                                            useSlackQuestion(reply, convo, bot);
                                            convo.next();
                                            // do something awesome here.
                                        }
                                    },
                                    {
                                        pattern: "i liked it",
                                        callback: function(reply, convo) {
                                            bot.replyInteractive(reply, fetchInteractiveReply("How would you rate this BBL?", "Like: I am glad you liked it!", "rate_bbl_like"));
                                            //convo.say('I am glad you liked it!');
                                            useSlackQuestion(reply, convo, bot);
                                            convo.next();
                                        }
                                    },
                                    {
                                        pattern: "it was awesome",
                                        callback: function(reply, convo) {
                                            bot.replyInteractive(reply, fetchInteractiveReply("How would you rate this BBL?", "Awesome: I am flying high :rocket:", "rate_bbl_awesome"));
                                            //convo.say('I am flying high :rocket:');
                                            useSlackQuestion(reply, convo, bot);
                                            convo.next();
                                        }
                                    },
                                    {
                                        default: true,
                                        callback: function(reply, convo) {
                                            convo.say('you chose not to click my buttons.. hmm i wonder');
                                            convo.next();
                                            console.log("reply:",reply);
                                            console.log("convo:",convo);
                                            console.log("response:",response);
                                        }
                                    }
                                ],{'key': 'rate_bbl'});
                                convo.on('end', function(dm) {
                                    if (dm.status == 'completed') {
                                        controller.storage.users.get(userInfo.user.id, function(err, user) {
                                            if (!user) {
                                                user = {
                                                    id: userInfo.user.id,
                                                    realName: userInfo.user.name,
                                                    channels: []
                                                }
                                            }

                                            feedback = "\n\nFeedback for @" + user.realName +
                                            ":\n How would you rate this BBL?\n "+dm.extractResponse('rate_bbl') +
                                            ":\n\n What do you think of Slack?\n "+dm.extractResponse('rate_slack') +
                                            "\n\n Which bot would you want to use?\n " + dm.extractResponse('fav_bot') +
                                            "\n\n Which of the following ideas would you like to see as bots?\n " + dm.extractResponse('otherIdeas') +
                                            "\n\n Any other ideas/pain points/comments/feedback..?\n " + dm.extractResponse('extraComments');

                                            user.channels.push({
                                                id: message.channel,
                                                surveys: [{
                                                    id: 'bbl',
                                                    text:feedback
                                                }]
                                            });

                                            console.log("User Object: ", user)
                                            controller.storage.users.save(user, function(err, id) {
                                                console.log("User:",id);
                                            });
                                        })
                                    }
                                    else {
                                        bot.startPrivateConversation(response.user, function(response, convo) { 
                                            convo.say('OK, this didnt go well, Sorry about that..');
                                        });
                                    }
                                });
                            });
                        }
                    });
                }

                setTimeout(function() {
                    //get status & upload a file
                    getStatusAndUpload(message, 'bbl');
                }, process.env.CHANNEL_SURVEY_TIMEOUT);
            }

        }.bind(this));
    }
    else {
        bot.reply(message, 'Sorry <@' + message.user + '>, you are not authorized to spam :wink:');
    }
});

function useSlackQuestion(reply, convo, bot) {
    convo.ask({
        text: "What do you think of Slack?",
        attachments:[
            {
                title: 'choose your thought..',
                fallback: 'You are unable to choose the actions!',
                callback_id: 'rate_slack',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"not my tool",
                        "text": "Not my tool :card_file_box: ",
                        "value": "not my tool",
                        "type": "button",
                    },
                    {
                        "name":"interested",
                        "text": "Interested :raised_hand::skin-tone-4: ",
                        "value": "interested",
                        "type": "button",
                    },
                    {
                        "name":"my favorite",
                        "text": "My Favorite :heart: ",
                        "value": "my favorite",
                        "type": "button",
                    }
                ]
            }
        ]
    },[
        {
            pattern: "not my tool",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("How do you think of Slack?", "Not my tool :neutral_face: ", "rate_slack_notMyTool"));
                //convo.say('it was only okay?');
                whichBotQuestion(reply, convo, bot);
                convo.next();
                // do something awesome here.
            }
        },
        {
            pattern: "interested",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("How do you think of Slack?", "Interested! :raised_hand::skin-tone-4: ", "rate_slack_interested"));
                //convo.say('I am glad you liked it!');
                whichBotQuestion(reply, convo, bot);
                convo.next();
            }
        },
        {
            pattern: "my favorite",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("How do you think of Slack?", "My favorite :heart:", "rate_slack_fav"));
                //convo.say('I am flying high :rocket:');
                whichBotQuestion(reply, convo, bot);
                convo.next();
            }
        },
        {
            default: true,
            callback: function(reply, convo) {
                convo.say('you chose not to click my buttons.. hmm i wonder');
                convo.next();
                console.log("reply:",reply);
                console.log("convo:",convo);
                console.log("response:",response);
            }
        }
    ],{'key': 'rate_slack'});
}

function whichBotQuestion(reply, convo, bot) {
    convo.ask({
        text: "Which bot would you want to use?",
        attachments:[
            {
                title: 'choose your :robot_face:',
                fallback: 'You are unable to choose the actions!',
                callback_id: 'which_bot',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"scrum bot",
                        "text": "@scrum_bot :scrum_bot:",
                        "value": "scrum bot",
                        "type": "button",
                    },
                    {
                        "name":"cats bot",
                        "text": "@cats_bot :cats_bot:",
                        "value": "cats bot",
                        "type": "button",
                    },
                    {
                        "name":"survey bot",
                        "text": "@survey_bot :survey_bot:",
                        "value": "survey bot",
                        "type": "button",
                    },
                    {
                        "name":"watson bot",
                        "text": "@watson_bot :watson_bot:",
                        "value": "watson bot",
                        "type": "button",
                    }
                ]
            }
        ]
    },[
        {
            pattern: "scrum bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which bot would you want to use?", "@scrum_bot :scrum_bot: - sounds like scrum masters take a lot of your time :wink: ", "bot_scrum"));
                //convo.say('it was only okay?');
                otherBotIdeas(reply, convo, bot);
                convo.next();
                // do something awesome here.
            }
        },
        {
            pattern: "cats bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which bot would you want to use?", "@cats_bot :cats_bot: - your PM will be very happy :smile: ", "bot_cats"));
                //convo.say('I am glad you liked it!');
                otherBotIdeas(reply, convo, bot);
                convo.next();
            }
        },
        {
            pattern: "survey bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which bot would you want to use?", "@survey_bot :survey_bot: - sounds like you are a fan of quick results :racing_car: ", "bot_survey"));
                //convo.say('I am flying high :rocket:');
                otherBotIdeas(reply, convo, bot);
                convo.next();
            }
        },
        {
            pattern: "watson bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which bot would you want to use?", "@watson_bot :watson_bot: - sounds like you are technology :ninja:", "bot_watson"));
                //convo.say('I am flying high :rocket:');
                otherBotIdeas(reply, convo, bot);
                convo.next();
            }
        },
        {
            default: true,
            callback: function(reply, convo) {
                convo.say('you chose not to click my buttons.. hmm i wonder');
                convo.next();
                console.log("reply:",reply);
                console.log("convo:",convo);
                console.log("response:",response);
            }
        }
    ],{'key': 'fav_bot'});
}

function otherBotIdeas(reply, convo, bot) {
    convo.ask({
        text: "Which of the following ideas would you like to see as bots?",
        attachments:[
            {
                title: 'choose your idea',
                fallback: 'You are unable to choose the actions!',
                callback_id: 'other_bot',
                attachment_type: 'default',
                actions: [
                    {
                        "name":"vacation tracker bot",
                        "text": "Vacation tracker :robot_face:",
                        "value": "vacation tracker bot",
                        "type": "button",
                    },
                    {
                        "name":"360 feedback bot",
                        "text": "360 Feedback :robot_face:",
                        "value": "360 feedback bot",
                        "type": "button",
                    },
                    {
                        "name":"complaint bot",
                        "text": "Complaint :robot_face:",
                        "value": "complaint bot",
                        "type": "button",
                    },
                    {
                        "name":"purchase order bot",
                        "text": "Purchase order :robot_face:",
                        "value": "purchase order bot",
                        "type": "button",
                    }
                ]
            }
        ]
    },[
        {
            pattern: "vacation tracker bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which of the following ideas would you like to see as bots?", "Vacation tracker bot - Sounds like you travel a the world :world_map: ", "bot_vacationTracker"));
                //convo.say('it was only okay?');
                extraComments(reply, convo, bot);
                convo.next();
                // do something awesome here.
            }
        },
        {
            pattern: "360 feedback bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which of the following ideas would you like to see as bots?", "360 Feedback bot - sounds like you interested in growth :ok_hand::skin-tone-4: ", "bot_feedback"));
                //convo.say('I am glad you liked it!');
                extraComments(reply, convo, bot);
                convo.next();
            }
        },
        {
            pattern: "complaint bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which of the following ideas would you like to see as bots?", "Complaint bot - sounds like you need some peace of mind :peace_symbol: ", "bot_complaint"));
                //convo.say('I am flying high :rocket:');
                extraComments(reply, convo, bot);
                convo.next();
            }
        },
        {
            pattern: "purchase order bot",
            callback: function(reply, convo) {
                bot.replyInteractive(reply, fetchInteractiveReply("Which of the following ideas would you like to see as bots?", "Purchase order :robot_face: - sounds like you are the office admin :smile:", "bot_po"));
                //convo.say('I am flying high :rocket:');
                extraComments(reply, convo, bot);
                convo.next();
            }
        },
        {
            default: true,
            callback: function(reply, convo) {
                convo.say('you chose not to click my buttons.. hmm i wonder');
                convo.next();
                console.log("reply:",reply);
                console.log("convo:",convo);
                console.log("response:",response);
            }
        }
    ],{'key': 'otherIdeas'});
}

function extraComments(reply, convo, bot) {
    convo.ask("Any other ideas/pain points/comments/feedback..?", function(response, convo) {
        //convo.say("Awesome.");
        //askTodayStatus(response, convo);
        convo.say("Awesome! Thank you for your valuable feedback :sunglasses: ");
        convo.say("I'll make sure @ojas.gosar buys you a :beer: tonight.. ");
        convo.next();
    }, {'key': 'extraComments'});
}

function fetchInteractiveReply(interactiveText, interactiveTitle, interactiveCallbackId) {
    var interactiveReply = {
        text: interactiveText,
        attachments:[
            {
                title: interactiveTitle,
                fallback: 'nothing to fall back!',
                callback_id: interactiveCallbackId,
                attachment_type: 'default'
            }
        ]
    }
    return interactiveReply;
}

beepboop.on('botkit.rtm.started', function (bot, resource, meta) {
  var slackUserId = resource.SlackUserID

  if (meta.isNew && slackUserId) {
    bot.api.im.open({ user: slackUserId }, function (err, response) {
      if (err) {
        return console.log("im.open error:",err)
      }
      var dmChannel = response.channel.id
      bot.say({channel: dmChannel, text: 'Thanks for adding me to your team!'})
      bot.say({channel: dmChannel, text: 'Just /invite me to a channel!'})
    })
  }
});

controller.on('bot_channel_join', function (bot, message) {
    console.log("bot_channel_join")
  bot.reply(message, "I'm here!")
});

function getStatusAndUpload(message, key){
    controller.storage.users.all(function(err,userList) {

        if (err) {
            console.log("Error getting all users: ", err);
        }
        else {
            console.log("Success all users: ", JSON.stringify(userList));
            //var jsonUserList = JSON.stringify(userList);
            var status = "";
            
            for (user in userList) {
                console.log("userList[user].channels", userList[user].channels);
                for (userChannel in userList[user].channels) {
                    console.log("userList[user].channels[userChannel]:", userList[user].channels[userChannel]);
                    console.log("message.channel", message.channel);
                    if (userList[user].channels[userChannel].id == message.channel) {
                        for (surveys in userList[user].channels[userChannel].surveys) {
                            console.log("userList[user].channels[userChannel].surveys:", userList[user].channels[userChannel].surveys);
                            //console.log("key:", key);
                            if (userList[user].channels[userChannel].surveys[surveys].id == key) {
                                console.log("found Match:");
                                status += userList[user].channels[userChannel].surveys[surveys].text;
                            }
                        }
                    }

                }
            }

            console.log("Final feedback: ", status);
            bot.api.files.upload({
                content:((!status)? "No feedback provided" : status),
                filename: key+"Survey",
                channels: message.channel
            }, function(err,result) {
                if (err) {
                    console.log("Error uploading file", err);
                }
                else {
                    console.log("Result:",result);
                }

            });
        }
        
    });
}

beepboop.on('add_resource', function (msg) {
  console.log('received request to add bot to team')
});

// Send the user who added the bot to their team a welcome message the first time it's connected
beepboop.on('botkit.rtm.started', function (bot, resource, meta) {
  var slackUserId = resource.SlackUserID

  if (meta.isNew && slackUserId) {
    bot.api.im.open({ user: slackUserId }, function (err, response) {
      if (err) {
        return console.log("im.open error:",err)
      }
      var dmChannel = response.channel.id
      bot.say({channel: dmChannel, text: 'Thanks for adding me to your team!'})
      bot.say({channel: dmChannel, text: 'Just /invite me to a channel!'})
    })
  }
});

controller.hears(['status', 'state'], 'direct_message,direct_mention,mention', function(bot, message) {
    //var date = Moment().format("YYYYMMDD");
    getStatusAndUpload(message, 'bbl');
});
// areYouReadyForScrum = function(response, convo) { 
//     convo.ask('Its Scrum-time! Are you ready for standup?', [
//         {
//             pattern: bot.utterances.yes,
//             callback: function(response, convo) {
//                 convo.say('Great, lets begin..');
//                 askYesterdayStatus(response, convo);
//                 convo.next();
//             }
//         },
//         {
//             pattern: bot.utterances.no,
//             default: true,
//             callback: function(response, convo) {
//                 convo.say('Alright, will ping you in sometime..');
//                 timeOutRepeat(response, convo);
//                 convo.next();
//             }
//         }
//     ]);
// };

// askYesterdayStatus = function(response, convo) {
//     console.log(convo);
//     convo.ask("What did you do yesterday?", function(response, convo) {
//         convo.say("Awesome.");
//         askTodayStatus(response, convo);
//         convo.next();
//   }, {'key': 'yesterday'});
// };

// timeOutRepeat = function(response, convo) {
//     setTimeout(function() {
//         bot.startPrivateConversation(response, areYouReadyForScrum);
//         convo.next();
//     }, process.env.INDIVIDUAL_SCRUM_TIMEOUT);
// };

// askTodayStatus = function(response, convo) {
//   convo.ask("What do you plan to do today?", function(response, convo) {
//     convo.say("Ok. Sounds Great!")
//     askIssues(response, convo)
//     convo.next();
//   }, {'key': 'today'});
// };

// askIssues = function(response, convo) { 
//   convo.ask("Any impediments or blocking issues??", function(response, convo) {
//     convo.say("Ok! Thank you :simple_smile:  ");
//     convo.next();
//   }, {'key': 'issues'});
// };

// beepboop.on('add_resource', function (msg) {
//   console.log('received request to add bot to team')
// });

// // Send the user who added the bot to their team a welcome message the first time it's connected
// beepboop.on('botkit.rtm.started', function (bot, resource, meta) {
//   var slackUserId = resource.SlackUserID

//   if (meta.isNew && slackUserId) {
//     bot.api.im.open({ user: slackUserId }, function (err, response) {
//       if (err) {
//         return console.log("im.open error:",err)
//       }
//       var dmChannel = response.channel.id
//       bot.say({channel: dmChannel, text: 'Thanks for adding me to your team!'})
//       bot.say({channel: dmChannel, text: 'Just /invite me to a channel!'})
//     })
//   }
// });

controller.on('bot_channel_join', function (bot, message) {
    console.log("bot_channel_join")
  bot.reply(message, "I'm here!")
});

// controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

//     bot.api.reactions.add({
//         timestamp: message.ts,
//         channel: message.channel,
//         name: 'robot_face',
//     }, function(err, res) {
//         if (err) {
//             bot.botkit.log('Failed to add emoji reaction :(', err);
//         }
//     });


//     controller.storage.users.get(message.user, function(err, user) {
//         if (user && user.name) {
//             bot.reply(message, 'Hello ' + user.name + '!!');
//         } else {
//             bot.reply(message, 'Hello.');
//         }
//     });
// });

// controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
//     var name = message.match[1];
//     controller.storage.users.get(message.user, function(err, user) {
//         if (!user) {
//             user = {
//                 id: message.user,
//             };
//         }
//         user.name = name;
//         controller.storage.users.save(user, function(err, id) {
//             bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
//         });
//     });
// });

// controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

//     controller.storage.users.get(message.user, function(err, user) {
//         if (user && user.name) {
//             bot.reply(message, 'Your name is ' + user.name);
//         } else {
//             bot.startConversation(message, function(err, convo) {
//                 if (!err) {
//                     convo.say('I do not know your name yet!');
//                     convo.ask('What should I call you?', function(response, convo) {
//                         convo.ask('You want me to call you `' + response.text + '`?', [
//                             {
//                                 pattern: 'yes',
//                                 callback: function(response, convo) {
//                                     // since no further messages are queued after this,
//                                     // the conversation will end naturally with status == 'completed'
//                                     convo.next();
//                                 }
//                             },
//                             {
//                                 pattern: 'no',
//                                 callback: function(response, convo) {
//                                     // stop the conversation. this will cause it to end with status == 'stopped'
//                                     convo.stop();
//                                 }
//                             },
//                             {
//                                 default: true,
//                                 callback: function(response, convo) {
//                                     convo.repeat();
//                                     convo.next();
//                                 }
//                             }
//                         ]);

//                         convo.next();

//                     }, {'key': 'nickname'}); // store the results in a field called nickname

//                     convo.on('end', function(convo) {
//                         if (convo.status == 'completed') {
//                             bot.reply(message, 'OK! I will update my dossier...');

//                             controller.storage.users.get(message.user, function(err, user) {
//                                 if (!user) {
//                                     user = {
//                                         id: message.user,
//                                     };
//                                 }
//                                 user.name = convo.extractResponse('nickname');
//                                 controller.storage.users.save(user, function(err, id) {
//                                     bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
//                                 });
//                             });



//                         } else {
//                             // this happens if the conversation ended prematurely for some reason
//                             bot.reply(message, 'OK, nevermind!');
//                         }
//                     });
//                 }
//             });
//         }
//     });
// });

// controller.hears(['identify yourself', 'who are you', 'what is your name'],
//     'direct_message,direct_mention,mention', function(bot, message) {

//     var hostname = os.hostname();
//     var uptime = formatUptime(process.uptime());

//     bot.reply(message,
//         ':robot_face: I am a bot named <@' + bot.identity.name +
//         '>. I have been running for ' + uptime + ' on ' + hostname + '.' +
//         '\n I have been created by Mr. Ojas Gosar');

// });

// function formatUptime(uptime) {
//     var unit = 'second';
//     if (uptime > 60) {
//         uptime = uptime / 60;
//         unit = 'minute';
//     }
//     if (uptime > 60) {
//         uptime = uptime / 60;
//         unit = 'hour';
//     }
//     if (uptime != 1) {
//         unit = unit + 's';
//     }

//     uptime = uptime + ' ' + unit;
//     return uptime;
// }
