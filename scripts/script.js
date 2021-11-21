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

const Diagnostics = require('Diagnostics');


const Time = require('Time');
              
// Create an empty array to store active participants
var activeParticipants = [];

var turnIndex = 0;

var backgroundIndex = 0;


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

    // Create a message channel to send background index updates on
  const syncBGChannel = Multipeer.getMessageChannel('SyncBGTopic');
              
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

        // Call the function that handles participants joining or leaving
        onUserEnterOrLeave(snapshot.userIndex, event.newValue);
      });
          
          
    // Add the participant to the active participants array
    activeParticipants.push(participant);
  });

  // Monitor when a new participant joins the call
  Participants.onOtherParticipantAdded().subscribe(function(participant) {

     // Add the participant to the master list
     participants.push(participant);

     // Monitor and subscribe to the participant's isActiveInSameEffect property
    // The callback function will be called whenever the signal's value changes
    participant.isActiveInSameEffect.monitor().subscribeWithSnapshot({
          
      // Capture the participant's ID in the snapshot so that it can be accessed
      // in the callback function
      userIndex: participants.indexOf(participant),
          
    // Pass the event and snapshot to the callback function
    }, function(event, snapshot) {
          
      // Call the function that handles participants joining or leaving
      onUserEnterOrLeave(snapshot.userIndex, event.newValue);
    });
  });
              
  // Do an initial sort of the active participants when the effect starts
  sortActiveParticipantList();

  // Do an initial check of whether this participant should display the 
  // turn panel
  checkShowTurnPanel();
              
              
  
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

  // Updates the turn index and active participant list when a user 
  // joins or leaves
  // This will be passed as the callback function for the master
  // participant list iteration implemented earlier
  // If a participant joins 'isActive' is true, if they leave it's false
  function onUserEnterOrLeave(userIndex, isActive) {
          
    // Get a participant from the participant array
    let participant = participants[userIndex];
          
    // Keep a reference of the current turn participant before adding or
    // removing anyone
    let currentTurnParticipant = activeParticipants[turnIndex];
  
    // If a participant has joined
    if (isActive) {
          
      // Log a message to the console
      Diagnostics.log("User entered the effect");
          
      // Add the participant to the active participants list
      activeParticipants.push(participant);

      // After 1 second, send the new participant the current background
      // index
      // The delay allows them time to set up their messaging subscriptions
      Time.setTimeout(function() {
          
          
        // Broadcast a message to all other participants, containing the
        // updated background index value
        syncBGChannel.sendMessage({'background': backgroundIndex }, false).
                                                               catch(err => {
          
          // If an error occurs, log it to the console
          Diagnostics.log(err);
        });
      }, 1000);   
          
    } else {
    
      // Log a message to the console
      Diagnostics.log("User left the effect");
          
      // Update the active participants list with the new participant
      let activeIndex = activeParticipants.indexOf(participant);
      activeParticipants.splice(activeIndex, 1);
    }

    // After adding or removing the participant, sort the list again
    sortActiveParticipantList();

    // If the user whose turn it was is still in the effect, change the
    // turnIndex to that user's new index
    if (activeParticipants.includes(currentTurnParticipant)) {
      turnIndex = activeParticipants.indexOf(currentTurnParticipant);
  
    // If the user whose turn it was is no longer in the effect, update the
    // turnIndex as it could be too high now
    } else {
      turnIndex = turnIndex%activeParticipants.length;
    }

    // Call the function that checks if the text panel should be displayed 
    // by this participant
    checkShowTurnPanel();
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







