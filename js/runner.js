import {
  assets,
  config,
  classes,
  defaultDimensions,
  events,
  keycodes,
  sounds,
  spriteDefinition,
  loadTimeData,
} from './constants.js'

import { FPS, IS_HIDPI, IS_IOS, IS_MOBILE, DEFAULT_WIDTH } from './config.js'

import {
  updateCanvasScaling,
  decodeBase64ToArrayBuffer,
  createCanvas,
  getTimeStamp,
  checkForCollision,
  vibrate,
} from './utils.js'

import DistanceMeter from './distance-meter.js'
import Horizon from './horizon.js'
import GameOverPanel from './game-panel.js'
import Trex from './trex.js'
import Obstacle from './obstacle.js'

export default class Runner {
  /**
   * constructor
   *
   * @param {*} outerContainerId
   * @param {*} opt_config
   */
  constructor(outerContainerId, opt_config) {
    // Singleton
    if (Runner._instance) {
      throw new Error("Singleton classes can't be instantiated more than once.")
    }
    Runner._instance = this

    this.outerContainerEl = document.querySelector(outerContainerId)
    this.containerEl = null
    this.snackbarEl = null
    this.detailsButton = this.outerContainerEl.querySelector('#details-button')

    this.config = opt_config || config

    this.dimensions = defaultDimensions

    this.canvas = null
    this.canvasCtx = null

    this.tRex = null

    this.distanceMeter = null
    this.distanceRan = 0

    this.highestScore = 0

    this.time = 0
    this.runningTime = 0
    this.msPerFrame = 1000 / FPS
    this.currentSpeed = this.config.SPEED

    this.obstacles = []

    this.activated = false // Whether the easter egg has been activated.
    this.playing = false // Whether the game is currently in play state.
    this.crashed = false
    this.paused = false
    this.inverted = false
    this.invertTimer = 0
    this.resizeTimerId_ = null

    this.playCount = 0

    // Sound FX.
    this.audioBuffer = null
    this.soundFx = {}

    // Global web audio context for playing sounds.
    this.audioContext = null

    // Images.
    this.images = {}
    this.imagesLoaded = 0

    this.manifestCache = {}
    this.defaultObstacleTypes = Obstacle.types.slice()

    if (this.isDisabled()) {
      this.setupDisabledRunner()
    } else {
      this.loadImages()
    }
  } // end of constructor

  // ========== static properties ==============
  static staticProperty = 'someValue'
  static staticMethod() {
    return 'static method has been called.'
  }
  static {
    console.log('Class static initialization block called')
  }

  static imageSprite = null

  // =========== member functions ==================

  /**
   * Whether the easter egg has been disabled. CrOS enterprise enrolled devices.
   * @return {boolean}
   */
  isDisabled() {
    // return loadTimeData && loadTimeData.valueExists('disabledEasterEgg');
    return false
  }

  /**
   * For disabled instances, set up a snackbar with the disabled message.
   */
  setupDisabledRunner() {
    this.containerEl = document.createElement('div')
    this.containerEl.className = classes.SNACKBAR
    this.containerEl.textContent = loadTimeData.getValue('disabledEasterEgg')
    this.outerContainerEl.appendChild(this.containerEl)

    // Show notification when the activation key is pressed.
    document.addEventListener(
      events.KEYDOWN,
      function (e) {
        if (keycodes.JUMP[e.keyCode]) {
          this.containerEl.classList.add(classes.SNACKBAR_SHOW)
          document.querySelector('.icon').classList.add('icon-disabled')
        }
      }.bind(this),
    )
  }

  /**
   * Setting individual settings for debugging.
   * @param {string} setting
   * @param {*} value
   */
  updateConfigSetting(setting, value) {
    if (setting in this.config && value != undefined) {
      this.config[setting] = value

      switch (setting) {
        case 'GRAVITY':
        case 'MIN_JUMP_HEIGHT':
        case 'SPEED_DROP_COEFFICIENT':
          this.tRex.config[setting] = value
          break
        case 'INITIAL_JUMP_VELOCITY':
          this.tRex.setJumpVelocity(value)
          break
        case 'SPEED':
          this.setSpeed(value)
          break
      }
    }
  }

  /**
   *
   * Cache the appropriate image sprite from the page and get the sprite sheet
   * definition.
   */
  loadImages() {
    const promises = []

    if (IS_HIDPI) {
      assets.imageSprite = document.getElementById('offline-resources-2x')
      this.spriteDef = spriteDefinition.HDPI
    } else {
      assets.imageSprite = document.getElementById('offline-resources-1x')
      this.spriteDef = spriteDefinition.LDPI
    }
    const spriteReady = new Promise((resolve) => {
      if (assets.imageSprite.complete) {
        resolve()
      } else {
        assets.imageSprite.addEventListener(events.LOAD, resolve)
      }
    })

    spriteReady.then(() => {
      const saved = JSON.parse(localStorage.getItem('skinSelection') || '{}')
      const selection = {
        character: saved.character || 'sonic',
        ground: saved.ground || 'sonic',
        obstacles: saved.obstacles || 'sonic',
      }
      this.setSkin(selection).then(() => this.init())
    })
  }

  async loadManifest(name) {
    if (!this.manifestCache[name]) {
      const res = await fetch(`skins/${name}/manifest.json`)
      this.manifestCache[name] = await res.json()
    }
    return this.manifestCache[name]
  }

  async setSkin(selection) {
    const parts = selection || {}
    const promises = []

    const loadImage = (src, skin) =>
      new Promise((resolve) => {
        const img = new Image()
        img.src = `skins/${skin}/` + src
        img.addEventListener(events.LOAD, () => resolve(img))
      })

    if (parts.character) {
      promises.push(
        (async () => {
          const manifest = await this.loadManifest(parts.character)
          const char = manifest.character
          const idle = await loadImage(char.idle, parts.character)
          const runFrames = await Promise.all(
            char.run.map((p) => loadImage(p, parts.character)),
          )
          const dead = await loadImage(char.dead, parts.character)
          assets.character = { idle, run: runFrames, dead }
        })(),
      )
    }

    if (parts.ground) {
      promises.push(
        (async () => {
          const manifest = await this.loadManifest(parts.ground)
          assets.ground = await loadImage(manifest.ground, parts.ground)
        })(),
      )
    }

    if (parts.obstacles) {
      promises.push(
        (async () => {
          const manifest = await this.loadManifest(parts.obstacles)
          assets.obstacles = {}
          await Promise.all(
            Object.entries(manifest.obstacles || {}).map(
              ([type, src]) =>
                loadImage(src, parts.obstacles).then((img) => {
                  assets.obstacles[type] = img
                }),
            ),
          )
          Obstacle.types = this.defaultObstacleTypes.filter(
            (t) => assets.obstacles[t.type],
          )
        })(),
      )
    }

    await Promise.all(promises)

    Trex.animFrames = {
      WAITING: { frames: [assets.character.idle], msPerFrame: 1000 / 3 },
      RUNNING: { frames: assets.character.run, msPerFrame: 1000 / 12 },
      CRASHED: { frames: [assets.character.dead], msPerFrame: 1000 / 60 },
      JUMPING: { frames: [assets.character.run[0]], msPerFrame: 1000 / 60 },
      DUCKING: { frames: assets.character.run, msPerFrame: 1000 / 8 },
    }

    if (this.tRex) {
      this.tRex.images = assets.character
      this.tRex.update(0, this.tRex.status)
    }
    if (this.horizon) {
      this.horizon.obstacles = []
      this.horizon.horizonLine.draw()
    }

    localStorage.setItem('skinSelection', JSON.stringify(parts))
  }

  /**
   * Load and decode base 64 encoded sounds.
   */
  loadSounds() {
    if (!IS_IOS) {
      this.audioContext = new AudioContext()

      var resourceTemplate = document.getElementById(
        this.config.RESOURCE_TEMPLATE_ID,
      ).content

      for (var sound in sounds) {
        var soundSrc = resourceTemplate.getElementById(sounds[sound]).src
        soundSrc = soundSrc.substr(soundSrc.indexOf(',') + 1)
        var buffer = decodeBase64ToArrayBuffer(soundSrc)

        // Async, so no guarantee of order in array.
        this.audioContext.decodeAudioData(
          buffer,
          function (index, audioData) {
            this.soundFx[index] = audioData
          }.bind(this, sound),
        )
      }
    }
  }

  /**
   * Sets the game speed. Adjust the speed accordingly if on a smaller screen.
   * @param {number} opt_speed
   */
  setSpeed(opt_speed) {
    var speed = opt_speed || this.currentSpeed

    // Reduce the speed on smaller mobile screens.
    if (this.dimensions.WIDTH < DEFAULT_WIDTH) {
      var mobileSpeed =
        ((speed * this.dimensions.WIDTH) / DEFAULT_WIDTH) *
        this.config.MOBILE_SPEED_COEFFICIENT
      this.currentSpeed = mobileSpeed > speed ? speed : mobileSpeed
    } else if (opt_speed) {
      this.currentSpeed = opt_speed
    }
  }

  /**
   * Game initialiser.
   */
  init() {
    // Hide the static icon.
    document.querySelector('.' + classes.ICON).style.visibility = 'hidden'

    this.adjustDimensions()
    this.setSpeed()

    this.containerEl = document.createElement('div')
    this.containerEl.className = classes.CONTAINER

    // Player canvas container.
    this.canvas = createCanvas(
      this.containerEl,
      this.dimensions.WIDTH,
      this.dimensions.HEIGHT,
      classes.PLAYER,
    )

    this.canvasCtx = this.canvas.getContext('2d')
    this.canvasCtx.fillStyle = '#f7f7f7'
    this.canvasCtx.fill()
    updateCanvasScaling(this.canvas)

    // Horizon contains clouds, obstacles and the ground.
    this.horizon = new Horizon(
      this.canvas,
      this.spriteDef,
      this.dimensions,
      this.config.GAP_COEFFICIENT,
    )

    // Distance meter
    this.distanceMeter = new DistanceMeter(
      this.canvas,
      this.spriteDef.TEXT_SPRITE,
      this.dimensions.WIDTH,
    )

    // Draw t-rex
    this.tRex = new Trex(this.canvas, assets.character)

    this.outerContainerEl.appendChild(this.containerEl)

    if (IS_MOBILE) {
      this.createTouchController()
    }

    this.startListening()
    this.update()

    window.addEventListener(events.RESIZE, this.debounceResize.bind(this))
  }

  /**
   * Create the touch controller. A div that covers whole screen.
   */
  createTouchController() {
    this.touchController = document.createElement('div')
    this.touchController.className = classes.TOUCH_CONTROLLER
    this.outerContainerEl.appendChild(this.touchController)
  }

  /**
   * Debounce the resize event.
   */
  debounceResize() {
    if (!this.resizeTimerId_) {
      this.resizeTimerId_ = setInterval(this.adjustDimensions.bind(this), 250)
    }
  }

  /**
   * Adjust game space dimensions on resize.
   */
  adjustDimensions() {
    clearInterval(this.resizeTimerId_)
    this.resizeTimerId_ = null

    var boxStyles = window.getComputedStyle(this.outerContainerEl)
    var padding = Number(
      boxStyles.paddingLeft.substr(0, boxStyles.paddingLeft.length - 2),
    )

    this.dimensions.WIDTH = this.outerContainerEl.offsetWidth - padding * 2
    this.dimensions.WIDTH = Math.min(DEFAULT_WIDTH, this.dimensions.WIDTH) //Arcade Mode
    if (this.activated) {
      this.setArcadeModeContainerScale()
    }

    // Redraw the elements back onto the canvas.
    if (this.canvas) {
      this.canvas.width = this.dimensions.WIDTH
      this.canvas.height = this.dimensions.HEIGHT

      updateCanvasScaling(this.canvas)

      this.distanceMeter.calcXPos(this.dimensions.WIDTH)
      this.clearCanvas()
      this.horizon.update(0, 0, true)
      this.tRex.update(0)

      // Outer container and distance meter.
      if (this.playing || this.crashed || this.paused) {
        this.containerEl.style.width = this.dimensions.WIDTH + 'px'
        this.containerEl.style.height = this.dimensions.HEIGHT + 'px'
        this.distanceMeter.update(0, Math.ceil(this.distanceRan))
        this.stop()
      } else {
        this.tRex.draw(assets.character.idle)
      }

      // Game over panel.
      if (this.crashed && this.gameOverPanel) {
        this.gameOverPanel.updateDimensions(this.dimensions.WIDTH)
        this.gameOverPanel.draw()
      }
    }
  }

  /**
   * Play the game intro.
   * Canvas container width expands out to the full width.
   */
  playIntro() {
    if (!this.activated && !this.crashed) {
      this.playingIntro = true
      this.tRex.playingIntro = true

      // CSS animation definition.
      var keyframes =
        '@-webkit-keyframes intro { ' +
        'from { width:' +
        Trex.config.WIDTH +
        'px }' +
        'to { width: ' +
        this.dimensions.WIDTH +
        'px }' +
        '}'

      // create a style sheet to put the keyframe rule in
      // and then place the style sheet in the html head
      var sheet = document.createElement('style')
      sheet.innerHTML = keyframes
      document.head.appendChild(sheet)

      this.containerEl.addEventListener(
        events.ANIM_END,
        this.startGame.bind(this),
      )

      this.containerEl.style.webkitAnimation = 'intro .4s ease-out 1 both'
      this.containerEl.style.width = this.dimensions.WIDTH + 'px'

      // if (this.touchController) {
      //     this.outerContainerEl.appendChild(this.touchController);
      // }
      this.playing = true
      this.activated = true
    } else if (this.crashed) {
      this.restart()
    }
  }

  /**
   * Update the game status to started.
   */
  startGame() {
    this.setArcadeMode()
    this.runningTime = 0
    this.playingIntro = false
    this.tRex.playingIntro = false
    this.containerEl.style.webkitAnimation = ''
    this.playCount++
    // Handle tabbing off the page. Pause the current game.
    document.addEventListener(
      events.VISIBILITY,
      this.onVisibilityChange.bind(this),
    )

    window.addEventListener(events.BLUR, this.onVisibilityChange.bind(this))

    window.addEventListener(events.FOCUS, this.onVisibilityChange.bind(this))
  }

  clearCanvas() {
    this.canvasCtx.clearRect(
      0,
      0,
      this.dimensions.WIDTH,
      this.dimensions.HEIGHT,
    )
  }

  /**
   * Update the game frame and schedules the next one.
   */
  update() {
    this.updatePending = false

    var now = getTimeStamp()
    var deltaTime = now - (this.time || now)
    this.time = now

    if (this.playing) {
      this.clearCanvas()

      if (this.tRex.jumping) {
        this.tRex.updateJump(deltaTime)
      }

      this.runningTime += deltaTime
      var hasObstacles = this.runningTime > this.config.CLEAR_TIME

      // First jump triggers the intro.
      if (this.tRex.jumpCount == 1 && !this.playingIntro) {
        this.playIntro()
      }

      // The horizon doesn't move until the intro is over.
      if (this.playingIntro) {
        this.horizon.update(0, this.currentSpeed, hasObstacles)
      } else {
        deltaTime = !this.activated ? 0 : deltaTime
        this.horizon.update(
          deltaTime,
          this.currentSpeed,
          hasObstacles,
          this.inverted,
        )
      }

      // Check for collisions.
      var collision =
        hasObstacles && checkForCollision(this.horizon.obstacles[0], this.tRex)

      if (!collision) {
        this.distanceRan += (this.currentSpeed * deltaTime) / this.msPerFrame

        if (this.currentSpeed < this.config.MAX_SPEED) {
          this.currentSpeed += this.config.ACCELERATION
        }
      } else {
        this.gameOver()
      }

      var playAchievementSound = this.distanceMeter.update(
        deltaTime,
        Math.ceil(this.distanceRan),
      )

      if (playAchievementSound) {
        this.playSound(this.soundFx.SCORE)
      }

      // Night mode.
      if (this.invertTimer > this.config.INVERT_FADE_DURATION) {
        this.invertTimer = 0
        this.invertTrigger = false
        this.invert()
      } else if (this.invertTimer) {
        this.invertTimer += deltaTime
      } else {
        var actualDistance = this.distanceMeter.getActualDistance(
          Math.ceil(this.distanceRan),
        )

        if (actualDistance > 0) {
          this.invertTrigger = !(actualDistance % this.config.INVERT_DISTANCE)

          if (this.invertTrigger && this.invertTimer === 0) {
            this.invertTimer += deltaTime
            this.invert()
          }
        }
      }
    }

    if (
      this.playing ||
      (!this.activated && this.tRex.blinkCount < config.MAX_BLINK_COUNT)
    ) {
      this.tRex.update(deltaTime)
      this.scheduleNextUpdate()
    }
  }

  /**
   * Event handler.
   */
  handleEvent(e) {
    return function (evtType, events) {
      switch (evtType) {
        case events.KEYDOWN:
        case events.TOUCHSTART:
        case events.MOUSEDOWN:
          this.onKeyDown(e)
          break
        case events.KEYUP:
        case events.TOUCHEND:
        case events.MOUSEUP:
          this.onKeyUp(e)
          break
      }
    }.bind(this)(e.type, events)
  }

  /**
   * Bind relevant key / mouse / touch listeners.
   */
  startListening() {
    // Keys.
    document.addEventListener(events.KEYDOWN, this)
    document.addEventListener(events.KEYUP, this)
    if (IS_MOBILE) {
      // Mobile only touch devices.
      this.touchController.addEventListener(events.TOUCHSTART, this)
      this.touchController.addEventListener(events.TOUCHEND, this)
      this.containerEl.addEventListener(events.TOUCHSTART, this)
    } else {
      // Mouse.
      document.addEventListener(events.MOUSEDOWN, this)
      document.addEventListener(events.MOUSEUP, this)
    }
  }

  /**
   * Remove all listeners.
   */
  stopListening() {
    document.removeEventListener(events.KEYDOWN, this)
    document.removeEventListener(events.KEYUP, this)

    if (IS_MOBILE) {
      this.touchController.removeEventListener(events.TOUCHSTART, this)
      this.touchController.removeEventListener(events.TOUCHEND, this)
      this.containerEl.removeEventListener(events.TOUCHSTART, this)
    } else {
      document.removeEventListener(events.MOUSEDOWN, this)
      document.removeEventListener(events.MOUSEUP, this)
    }
  }

  /**
   * Process keydown.
   * @param {Event} e
   */
  onKeyDown(e) {
    // Prevent native page scrolling whilst tapping on mobile.
    if (IS_MOBILE && this.playing) {
      e.preventDefault()
    }
    if (e.target != this.detailsButton) {
      if (
        !this.crashed &&
        (keycodes.JUMP[e.keyCode] || e.type == events.TOUCHSTART)
      ) {
        if (!this.playing) {
          this.loadSounds()
          this.playing = true
          this.update()
          // if (window.errorPageController) {
          //   errorPageController.trackEasterEgg()
          // }
        }
        //  Play sound effect and jump on starting the game for the first time.
        if (!this.tRex.jumping && !this.tRex.ducking) {
          this.playSound(this.soundFx.BUTTON_PRESS)
          this.tRex.startJump(this.currentSpeed)
        }
      }

      if (
        this.crashed &&
        e.type == events.TOUCHSTART &&
        e.currentTarget == this.containerEl
      ) {
        this.restart()
      }
    }

    if (this.playing && !this.crashed && keycodes.DUCK[e.keyCode]) {
      e.preventDefault()
      if (this.tRex.jumping) {
        // Speed drop, activated only when jump key is not pressed.
        this.tRex.setSpeedDrop()
      } else if (!this.tRex.jumping && !this.tRex.ducking) {
        // Duck.
        this.tRex.setDuck(true)
      }
    }
  }

  /**
   * Process key up.
   * @param {Event} e
   */
  onKeyUp(e) {
    var keyCode = String(e.keyCode)
    var isjumpKey =
      keycodes.JUMP[keyCode] ||
      e.type == events.TOUCHEND ||
      e.type == events.MOUSEDOWN

    if (this.isRunning() && isjumpKey) {
      this.tRex.endJump()
    } else if (keycodes.DUCK[keyCode]) {
      this.tRex.speedDrop = false
      this.tRex.setDuck(false)
    } else if (this.crashed) {
      // Check that enough time has elapsed before allowing jump key to restart.
      var deltaTime = getTimeStamp() - this.time

      if (
        keycodes.RESTART[keyCode] ||
        this.isLeftClickOnCanvas(e) ||
        (deltaTime >= this.config.GAMEOVER_CLEAR_TIME && keycodes.JUMP[keyCode])
      ) {
        this.restart()
      }
    } else if (this.paused && isjumpKey) {
      // Reset the jump state
      this.tRex.reset()
      this.play()
    }
  }

  /**
   * Returns whether the event was a left click on canvas.
   * On Windows right click is registered as a click.
   * @param {Event} e
   * @return {boolean}
   */
  isLeftClickOnCanvas(e) {
    return (
      e.button != null &&
      e.button < 2 &&
      e.type == events.MOUSEUP &&
      e.target == this.canvas
    )
  }

  /**
   * RequestAnimationFrame wrapper.
   */
  scheduleNextUpdate() {
    if (!this.updatePending) {
      this.updatePending = true
      this.raqId = requestAnimationFrame(this.update.bind(this))
    }
  }

  /**
   * Whether the game is running.
   * @return {boolean}
   */
  isRunning() {
    return !!this.raqId
  }

  /**
   * Game over state.
   */
  gameOver() {
    this.playSound(this.soundFx.HIT)
    vibrate(200)

    this.stop()
    this.crashed = true
    this.distanceMeter.acheivement = false

    this.tRex.update(100, Trex.status.CRASHED)

    // Game over panel.
    if (!this.gameOverPanel) {
      this.gameOverPanel = new GameOverPanel(
        this.canvas,
        this.spriteDef.TEXT_SPRITE,
        this.spriteDef.RESTART,
        this.dimensions,
      )
    } else {
      this.gameOverPanel.draw()
    }

    // Update the high score.
    if (this.distanceRan > this.highestScore) {
      this.highestScore = Math.ceil(this.distanceRan)
      this.distanceMeter.setHighScore(this.highestScore)
    }

    // Reset the time clock.
    this.time = getTimeStamp()
  }

  stop() {
    this.playing = false
    this.paused = true
    cancelAnimationFrame(this.raqId)
    this.raqId = 0
  }

  play() {
    if (!this.crashed) {
      this.playing = true
      this.paused = false
      this.tRex.update(0, Trex.status.RUNNING)
      this.time = getTimeStamp()
      this.update()
    }
  }

  restart() {
    if (!this.raqId) {
      this.playCount++
      this.runningTime = 0
      this.playing = true
      this.crashed = false
      this.distanceRan = 0
      this.setSpeed(this.config.SPEED)
      this.time = getTimeStamp()
      this.containerEl.classList.remove(classes.CRASHED)
      this.clearCanvas()
      this.distanceMeter.reset(this.highestScore)
      this.horizon.reset()
      this.tRex.reset()
      this.playSound(this.soundFx.BUTTON_PRESS)
      this.invert(true)
      this.update()
    }
  }

  /**
   * Hides offline messaging for a fullscreen game only experience.
   */
  setArcadeMode() {
    document.body.classList.add(classes.ARCADE_MODE)
    this.setArcadeModeContainerScale()
  }

  /**
   * Sets the scaling for arcade mode.
   */
  setArcadeModeContainerScale() {
    const windowHeight = window.innerHeight
    const scaleHeight = windowHeight / this.dimensions.HEIGHT
    const scaleWidth = window.innerWidth / this.dimensions.WIDTH
    const scale = Math.max(1, Math.min(scaleHeight, scaleWidth))
    const scaledCanvasHeight = this.dimensions.HEIGHT * scale
    // Positions the game container at 10% of the available vertical window
    // height minus the game container height.
    const translateY =
      Math.ceil(
        Math.max(
          0,
          (windowHeight -
            scaledCanvasHeight -
            config.ARCADE_MODE_INITIAL_TOP_POSITION) *
            config.ARCADE_MODE_TOP_POSITION_PERCENT,
        ),
      ) * window.devicePixelRatio

    const cssScale = scale
    this.containerEl.style.transform =
      'scale(' + cssScale + ') translateY(' + translateY + 'px)'
  }

  /**
   * Pause the game if the tab is not in focus.
   */
  onVisibilityChange(e) {
    if (
      document.hidden ||
      document.webkitHidden ||
      e.type == 'blur' ||
      document.visibilityState != 'visible'
    ) {
      this.stop()
    } else if (!this.crashed) {
      this.tRex.reset()
      this.play()
    }
  }

  /**
   * Play a sound.
   * @param {SoundBuffer} soundBuffer
   */
  playSound(soundBuffer) {
    if (soundBuffer) {
      var sourceNode = this.audioContext.createBufferSource()
      sourceNode.buffer = soundBuffer
      sourceNode.connect(this.audioContext.destination)
      sourceNode.start(0)
    }
  }

  /**
   * Inverts the current page / canvas colors.
   * @param {boolean} Whether to reset colors.
   */
  invert(reset) {
    if (reset) {
      document.body.classList.toggle(classes.INVERTED, false)
      this.invertTimer = 0
      this.inverted = false
    } else {
      this.inverted = document.body.classList.toggle(
        classes.INVERTED,
        this.invertTrigger,
      )
    }
  }

  // end of Runner class
}

window['Runner'] = Runner
