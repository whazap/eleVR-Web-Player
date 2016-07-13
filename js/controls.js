/* global fullScreenButton, loopButton, muteButton, playL, playR, playButton, projectionSelect, quat, seekBar, videoSelect, vrHMD, vrSensor */

var reqAnimFrameID = 0;
var projection = 0;
var manualRotation = quat.create();

(function (global) {
  'use strict';

  var videoObjectURL;

  var controls = {
    video: null,
    canvas: null,
    manualControls: {
      'a': {index: 1, sign: 1, active: 0},
      'd': {index: 1, sign: -1, active: 0},
      'w': {index: 0, sign: 1, active: 0},
      's': {index: 0, sign: -1, active: 0},
      'q': {index: 2, sign: -1, active: 0},
      'e': {index: 2, sign: 1, active: 0},
    },

    manualRotateRate: new Float32Array([0, 0, 0]),  // Vector, camera-relative

    create: function (video, canvas) {
      controls.video = video;
      controls.canvas = canvas;
      playButton.addEventListener('click', function () {
        controls.playPause();
      });

      playL.addEventListener('click', function () {
        controls.playPause();
      });

      playR.addEventListener('click', function () {
        controls.playPause();
      });

      loopButton.addEventListener('click', function () {
        controls.toggleLooping();
      });

      muteButton.addEventListener('click', function () {
        if (controls.video.muted === false) {
          controls.mute();
        } else {
          controls.unmute();
        }
      });

      fullScreenButton.addEventListener('click', function () {
        controls.fullscreen();
      });

      recenterButton.addEventListener('click', function () {
        if (typeof vrSensor !== 'undefined') {
          vrSensor.zeroSensor(); // Untested
        } else {
          quat.invert(manualRotation, PhoneVR.getInstance().rotationQuat());
        }
      });

      seekBar.addEventListener('change', function () {
        // Calculate the new time
        var time = controls.video.duration * (seekBar.value / 100);
        controls.video.currentTime = time;
      });

      controls.video.addEventListener('timeupdate', function () {
        // don't update if paused,
        // we get last time update after seekBar mousedown pauses
        if (!controls.video.paused) {
          // Calculate the slider value
          var value = (100 / controls.video.duration) * controls.video.currentTime;
          seekBar.value = value;
        }
      });

      // Pause the video when the slider handle is being dragged
      var tempPause = false;
      seekBar.addEventListener('mousedown', function () {
        if (!controls.video.paused) {
          controls.video.pause();
          tempPause = true;
        }
      });

      seekBar.addEventListener('mouseup', function () {
        if (tempPause) {
          controls.video.play();
        }
      });

      videoSelect.addEventListener('change', function () {
        projection = videoSelect.value[0];
        projectionSelect.value = projection;

        // Remove the hash/querystring if there were custom video parameters.
        window.history.pushState('', document.title, window.location.pathname);

        controls.loadVideo(videoSelect.value.substring(1));

        var selectedOption = videoSelect.options[videoSelect.selectedIndex];
        if ('autoplay' in selectedOption.dataset) {
          controls.play();
        }
      });


      projectionSelect.addEventListener('change', function () {
        projection = projectionSelect.value;
      });

      document.getElementById('select-local-file').addEventListener('click', function (event) {
        event.preventDefault();
        controls.selectLocalVideo();
      });
    },

    enableKeyControls: function () {
      function key(event, sign) {
        var control = controls.manualControls[String.fromCharCode(event.keyCode).toLowerCase()];
        if (!control)
          return;
        if (sign === 1 && control.active || sign === -1 && !control.active)
          return;
        control.active = (sign === 1);
        controls.manualRotateRate[control.index] += sign * control.sign;
      }

      function onkey(event) {
        switch (String.fromCharCode(event.charCode)) {
          case 'f':
            controls.fullscreen();
            break;
          case 'z':
            if (typeof vrSensor !== 'undefined') {
              vrSensor.zeroSensor();
            }
            else {
              quat.invert(manualRotation, PhoneVR.getInstance().rotationQuat());
            }
            break;
          case 'p':
            controls.playPause();
            break;
          case ' ': //spacebar
            controls.playPause();
            break;
          case 'g':
            controls.fullscreenIgnoreHMD();
            break;
          case 'l':
            controls.toggleLooping();
            break;
        }
      }

      document.addEventListener('keydown', function (event) {
          key(event, 1);
        },
        false);
      document.addEventListener('keyup', function (event) {
          key(event, -1);
        },
        false);
      window.addEventListener('keypress', onkey, true);
    },

    /**
     * Video Commands
     */
    loaded: function () {
      window.leftLoad.classList.add('hidden');
      window.rightLoad.classList.add('hidden');
      if (controls.video.paused) {
        window.leftPlay.classList.remove('hidden');
        window.rightPlay.classList.remove('hidden');
      }
    },

    play: function () {
      if (controls.video.ended) {
        controls.video.currentTime = 0.1;
      }

      controls.video.play();
      if (!controls.video.paused) { // In case somehow hitting play button doesn't work.
        window.leftPlay.classList.add('hidden');
        window.rightPlay.classList.add('hidden');

        window.playButton.className = 'fa fa-pause icon';
        window.playButton.title = 'Pause';
      }
    },

    pause: function () {
      controls.video.pause();

      window.playButton.className = 'fa fa-play icon';
      window.playButton.title = 'Play';

      window.leftPlay.classList.remove('hidden');
      window.rightPlay.classList.remove('hidden');
    },

    playPause: function () {
      if (controls.video.paused === true) {
        controls.play();
      } else {
        controls.pause();
      }
    },

    setLooping: function (loop) {
      loop = !!loop;
      if (controls.video.loop !== loop) {
        controls.toggleLooping();
      }
    },

    toggleLooping: function () {
      if (controls.video.loop === true) {
        loopButton.className = 'fa fa-refresh icon';
        loopButton.title = 'Start Looping';
        controls.video.loop = false;
      } else {
        loopButton.className = 'fa fa-chain-broken icon';
        loopButton.title = 'Stop Looping';
        controls.video.loop = true;
      }
    },

    ended: function () {
      controls.pause();
    },

    mute: function () {
      if (controls.video.muted) {
        return;
      }
      controls.video.muted = true;
      window.muteButton.className = 'fa fa-volume-off icon';
      window.muteButton.title = 'Unmute';
    },

    unmute: function () {
      if (!controls.video.muted) {
        return;
      }
      controls.video.muted = false;
      window.muteButton.className = 'fa fa-volume-up icon';
      window.muteButton.title = 'Mute';
    },

    selectLocalVideo: function () {
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';

      input.addEventListener('change', function () {
        var files = input.files;
        if (!files.length) {
          // The user didn't select anything.  Sad.
          console.log('File selection canceled');
          return;
        }

        videoObjectURL = URL.createObjectURL(files[0]);
        console.log('Loading local file ', files[0].name, ' at URL ', videoObjectURL);
        videoSelect.value = '';
        controls.loadVideo(videoObjectURL);
      });

      input.click();
    },

    loadVideo: function (videoFile) {
      controls.pause();
      window.leftPlay.classList.add('hidden');
      window.rightPlay.classList.add('hidden');
      window.leftLoad.classList.remove('hidden');
      window.rightLoad.classList.remove('hidden');

      if (reqAnimFrameID) {
        cancelAnimationFrame(reqAnimFrameID);
        reqAnimFrameID = 0;
      }

      manualRotation = quat.create();

      var oldObjURL = videoObjectURL;
      videoObjectURL = null;

      controls.video.src = videoFile;

      if (videoObjectURL && videoObjectURL !== videoFile) {
        URL.removeObjectURL(oldObjURL);
      }
    },

    fullscreen: function () {
      if (controls.canvas.mozRequestFullScreen) {
        controls.canvas.mozRequestFullScreen({vrDisplay: vrHMD}); // Firefox
      } else if (controls.canvas.webkitRequestFullscreen) {
        controls.canvas.webkitRequestFullscreen({vrDisplay: vrHMD}); // Chrome and Safari
      } else if (controls.canvas.requestFullScreen) {
        controls.canvas.requestFullscreen();
      }
    },

    fullscreenIgnoreHMD: function () {
      if (controls.canvas.mozRequestFullScreen) {
        controls.canvas.mozRequestFullScreen(); // Firefox
      } else if (controls.canvas.webkitRequestFullscreen) {
        controls.canvas.webkitRequestFullscreen(); // Chrome and Safari
      } else if (controls.canvas.requestFullScreen) {
        controls.canvas.requestFullscreen();
      }
    },

    hide: function () {
      window.videoControls.classList.add('hidden');
      window.messageL.classList.add('hidden');
      window.messageR.classList.add('hidden');
    },

    show: function () {
      window.videoControls.classList.remove('hidden');
      window.messageL.classList.remove('hidden');
      window.messageR.classList.remove('hidden');
    }
  };

  global.controls = controls;

})(window);
