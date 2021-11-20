/**
 * (c) Facebook, Inc. and its affiliates. Confidential and proprietary.
 */

//==============================================================================
// Welcome to scripting in Spark AR Studio! Helpful links:
//
// Scripting Basics - https://fb.me/spark-scripting-basics
// Reactive Programming - https://fb.me/spark-reactive-programming
// Scripting Object Reference - https://fb.me/spark-scripting-reference
// Changelogs - https://fb.me/spark-changelog
//
// Spark AR Studio extension for VS Code - https://fb.me/spark-vscode-plugin
//
// For projects created with v87 onwards, JavaScript is always executed in strict mode.
//==============================================================================



// How to load in modules
const Scene = require('Scene');
// Import the Participants module so that we can use the API
const Participants = require('Participants');

const Patches = require('Patches');

const Multipeer = require('Multipeer');
              
// Create an empty array to store active participants
var activeParticipants = [];

var turnIndex = 0;


// Use export keyword to make a symbol available in scripting debug console
export const Diagnostics = require('Diagnostics');

// To use variables and functions across files, use export/import keyword
// export const animationDuration = 10;

// Use import keyword to import a symbol from another file
// import { animationDuration } from './script.js'

(async function() { // Enable async/await in JS [part 1]
          
  // Retrieve the current participant
  const self = await Participants.self;
          
  // Retrieve all other participants          
  const participants = await Participants.getAllOtherParticipants();

  // Add self to the participants array, as it only fetches
  // other participants
  participants.push(self);

    // Create a message channel to send turn index updates on
    const syncTurnChannel = Multipeer.getMessageChannel('SyncTurnTopic');
              
    // Get the 'Screen Tap and Hold' pulse event from the Patch Editor
    const turnPulseRequest = await Patches.
                               outputs.getPulse('turnPulseRequest');
   
              
  // Iterate through each participant in the master list
  participants.forEach(function(participant) {
          
    // Monitor and subscribe to the participant's isActiveInSameEffect
    // property
    // The callback function will be called whenever the signal's value
    // changes
    participant.isActiveInSameEffect.monitor().subscribeWithSnapshot({
          
      // Capture the participant's ID in the snapshot so that it can be 
      // accessed in the callback function
      userIndex: participants.indexOf(participant),
          
    // Pass the event and snapshot to the callback function
    }, function(event, snapshot) {
          
      // Participant join/leave method call will be added here at a
      // later step
    });
          
    // Add the participant to the active participants array
    activeParticipants.push(participant);
  });
              
  // Do an initial sort of the active participants when the effect starts
  sortActiveParticipantList();
              
  
  //==============================================
  // Custom Functions 
  //==============================================
              
  // Sort the active participant list by ID
  function sortActiveParticipantList(isActive) {
          
    activeParticipants.sort(function(a, b){
          
      if (a.id < b.id) {
        return -1;
      }
          
      if (a.id > b.id) {
        return 1;
      }
    });
  }
          

  // Check whether this participant should display the text panel
  // The panel will only display if it's this participant's turn
  function checkShowTurnPanel() {
          
    // Check if this participant's ID matches the ID in the turn index
    let isMyTurn = activeParticipants[turnIndex].id === self.id;
  
    // Send the returned boolean value to the Patch Editor and assign it 
    // to the showTurnPanel boolean
    Patches.inputs.setBoolean('showTurnPanel', isMyTurn);
  }
          
 //==============================================
  // Callback Functions 
  //==============================================
              
              
  // Subscribe to the pulse event, then pass the turn whenever it happens
  turnPulseRequest.subscribe(function() {
          
    // Check if it's this instance's turn
    if (activeParticipants[turnIndex].id === self.id) {
          
      // Increment the turn index to pass the turn to the next participant
      turnIndex = (turnIndex + 1) % activeParticipants.length; 
        
      // Check if this instance needs to display the turn panel, in case 
      // this instance is the only participant in the effect
      checkShowTurnPanel();
    
      // Broadcast a message to all other participants, containing the
      // updated turn index value
      syncTurnChannel.sendMessage({'turnIndex': turnIndex}, false).
                                                           catch(err => {
        Diagnostics.log(err);
      });
    }
  });
          
})(); // Enable async/await in JS [part 2]







