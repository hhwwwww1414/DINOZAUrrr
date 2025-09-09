import { IS_MOBILE, IS_IOS } from './config.js'
import { defaultDimensions, classes } from './constants.js'
import CollisionBox from './collision-box.js'

//******************************************************************************

/**
 * Updates the canvas size taking into
 * account the backing store pixel ratio and
 * the device pixel ratio.
 *
 * See article by Paul Lewis:
 * http://www.html5rocks.com/en/tutorials/canvas/hidpi/
 *
 * @param {HTMLCanvasElement} canvas
 * @param {number} opt_width
 * @param {number} opt_height
 * @return {boolean} Whether the canvas was scaled.
 */
export function updateCanvasScaling(canvas, opt_width, opt_height) {
  var context = canvas.getContext('2d')

  // Query the various pixel ratios
  var devicePixelRatio = Math.floor(window.devicePixelRatio) || 1
  var backingStoreRatio = Math.floor(context.webkitBackingStorePixelRatio) || 1
  var ratio = devicePixelRatio / backingStoreRatio

  // Upscale the canvas if the two ratios don't match
  if (devicePixelRatio !== backingStoreRatio) {
    var oldWidth = opt_width || canvas.width
    var oldHeight = opt_height || canvas.height

    canvas.width = oldWidth * ratio
    canvas.height = oldHeight * ratio

    canvas.style.width = oldWidth + 'px'
    canvas.style.height = oldHeight + 'px'

    // Scale the context to counter the fact that we've manually scaled
    // our canvas element.
    context.scale(ratio, ratio)
    return true
  } else if (devicePixelRatio == 1) {
    // Reset the canvas width / height. Fixes scaling bug when the page is
    // zoomed and the devicePixelRatio changes accordingly.
    canvas.style.width = canvas.width + 'px'
    canvas.style.height = canvas.height + 'px'
  }
  return false
}

/**
 * Check for a collision.
 * @param {!Obstacle} obstacle
 * @param {!Trex} tRex T-rex object.
 * @param {HTMLCanvasContext} opt_canvasCtx Optional canvas context for drawing
 *    collision boxes.
 * @return {Array<CollisionBox>}
 */
export function checkForCollision(obstacle, tRex, opt_canvasCtx) {
  var obstacleBoxXPos = defaultDimensions.WIDTH + obstacle.xPos

  // Adjustments are made to the bounding box as there is a 1 pixel white
  // border around the t-rex and obstacles.
  var tRexBox = new CollisionBox(
    tRex.xPos + 1,
    tRex.yPos + 1,
    tRex.config.WIDTH - 2,
    tRex.config.HEIGHT - 2,
  )

  var obstacleBox = new CollisionBox(
    obstacle.xPos + 1,
    obstacle.yPos + 1,
    obstacle.typeConfig.width * obstacle.size - 2,
    obstacle.typeConfig.height - 2,
  )

  // Debug outer box
  if (opt_canvasCtx) {
    drawCollisionBoxes(opt_canvasCtx, tRexBox, obstacleBox)
  }

  // Simple outer bounds check.
  if (boxCompare(tRexBox, obstacleBox)) {
    var collisionBoxes = obstacle.collisionBoxes
    var tRexCollisionBoxes = tRex.getCollistionBoxes()

    // Detailed axis aligned box check.
    for (var t = 0; t < tRexCollisionBoxes.length; t++) {
      for (var i = 0; i < collisionBoxes.length; i++) {
        // Adjust the box to actual positions.
        var adjTrexBox = createAdjustedCollisionBox(
          tRexCollisionBoxes[t],
          tRexBox,
        )
        var adjObstacleBox = createAdjustedCollisionBox(
          collisionBoxes[i],
          obstacleBox,
        )
        var crashed = boxCompare(adjTrexBox, adjObstacleBox)

        // Draw boxes for debug.
        if (opt_canvasCtx) {
          drawCollisionBoxes(opt_canvasCtx, adjTrexBox, adjObstacleBox)
        }

        if (crashed) {
          return [adjTrexBox, adjObstacleBox]
        }
      }
    }
  }
  return false
}

/**
 * Adjust the collision box.
 * @param {!CollisionBox} box The original box.
 * @param {!CollisionBox} adjustment Adjustment box.
 * @return {CollisionBox} The adjusted collision box object.
 */
export function createAdjustedCollisionBox(box, adjustment) {
  return new CollisionBox(
    box.x + adjustment.x,
    box.y + adjustment.y,
    box.width,
    box.height,
  )
}

/**
 * Draw the collision boxes for debug.
 */
export function drawCollisionBoxes(canvasCtx, tRexBox, obstacleBox) {
  canvasCtx.save()
  canvasCtx.strokeStyle = '#f00'
  canvasCtx.strokeRect(tRexBox.x, tRexBox.y, tRexBox.width, tRexBox.height)

  canvasCtx.strokeStyle = '#0f0'
  canvasCtx.strokeRect(
    obstacleBox.x,
    obstacleBox.y,
    obstacleBox.width,
    obstacleBox.height,
  )
  canvasCtx.restore()
}

/**
 * Compare two collision boxes for a collision.
 * @param {CollisionBox} tRexBox
 * @param {CollisionBox} obstacleBox
 * @return {boolean} Whether the boxes intersected.
 */
export function boxCompare(tRexBox, obstacleBox) {
  var crashed = false
  var tRexBoxX = tRexBox.x
  var tRexBoxY = tRexBox.y

  var obstacleBoxX = obstacleBox.x
  var obstacleBoxY = obstacleBox.y

  // Axis-Aligned Bounding Box method.
  if (
    tRexBox.x < obstacleBoxX + obstacleBox.width &&
    tRexBox.x + tRexBox.width > obstacleBoxX &&
    tRexBox.y < obstacleBox.y + obstacleBox.height &&
    tRexBox.height + tRexBox.y > obstacleBox.y
  ) {
    crashed = true
  }

  return crashed
}

/**
 * Get random number.
 * @param {number} min
 * @param {number} max
 * @param {number}
 */
export function getRandomNum(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Vibrate on mobile devices.
 * @param {number} duration Duration of the vibration in milliseconds.
 */
export function vibrate(duration) {
  if (IS_MOBILE && window.navigator.vibrate) {
    window.navigator.vibrate(duration)
  }
}

/**
 * Create canvas element.
 * @param {HTMLElement} container Element to append canvas to.
 * @param {number} width
 * @param {number} height
 * @param {string} opt_classname
 * @return {HTMLCanvasElement}
 */
export function createCanvas(container, width, height, opt_classname) {
  var canvas = document.createElement('canvas')
  canvas.className = opt_classname
    ? classes.CANVAS + ' ' + opt_classname
    : classes.CANVAS
  canvas.width = width
  canvas.height = height
  container.appendChild(canvas)

  return canvas
}

/**
 * Decodes the base 64 audio to ArrayBuffer used by Web Audio.
 * @param {string} base64String
 */
export function decodeBase64ToArrayBuffer(base64String) {
  var len = (base64String.length / 4) * 3
  var str = atob(base64String)
  var arrayBuffer = new ArrayBuffer(len)
  var bytes = new Uint8Array(arrayBuffer)

  for (var i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i)
  }
  return bytes.buffer
}

/**
 * Return the current timestamp.
 * @return {number}
 */
export function getTimeStamp() {
  return IS_IOS ? new Date().getTime() : performance.now()
}
