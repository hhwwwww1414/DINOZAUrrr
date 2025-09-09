import CollisionBox from './collision-box.js'
import { getRandomNum } from './utils.js'
import { IS_MOBILE, FPS } from './config.js'

/**
 * Obstacle.
 * @param {HTMLCanvasCtx} canvasCtx
 * @param {Obstacle.type} type
 * @param {HTMLImageElement} image Obstacle image.
 * @param {Object} dimensions
 * @param {number} gapCoefficient Mutipler in determining the gap.
 * @param {number} speed
 * @param {number} opt_xOffset
 */
export default class Obstacle {
  constructor(canvasCtx, type, image, dimensions, gapCoefficient, speed, opt_xOffset) {
    this.canvasCtx = canvasCtx
    this.image = image
    this.typeConfig = type
    this.gapCoefficient = gapCoefficient
    this.size = 1
    this.dimensions = dimensions
    this.remove = false
    this.xPos = dimensions.WIDTH + (opt_xOffset || 0)
    this.yPos = 0
    this.width = 0
    this.collisionBoxes = []
    this.gap = 0
    this.speedOffset = 0

    // For animated obstacles.
    this.currentFrame = 0
    this.timer = 0

    this.init(speed)
  }

  /**
   * Initialise the DOM for the obstacle.
   * @param {number} speed
   */
  init(speed) {
    this.cloneCollisionBoxes()

    this.width = this.typeConfig.width

    // Check if obstacle can be positioned at various heights.
    if (Array.isArray(this.typeConfig.yPos)) {
      var yPosConfig = IS_MOBILE
        ? this.typeConfig.yPosMobile
        : this.typeConfig.yPos
      this.yPos = yPosConfig[getRandomNum(0, yPosConfig.length - 1)]
    } else {
      this.yPos = this.typeConfig.yPos
    }

    this.draw()

    // For obstacles that go at a different speed from the horizon.
    if (this.typeConfig.speedOffset) {
      this.speedOffset =
        Math.random() > 0.5
          ? this.typeConfig.speedOffset
          : -this.typeConfig.speedOffset
    }

    this.gap = this.getGap(this.gapCoefficient, speed)
  }

  /**
   * Draw and crop based on size.
   */
  draw() {
    this.canvasCtx.drawImage(
      this.image,
      this.xPos,
      this.yPos,
      this.typeConfig.width,
      this.typeConfig.height,
    )
  }

  /**
   * Obstacle frame update.
   * @param {number} deltaTime
   * @param {number} speed
   */
  update(deltaTime, speed) {
    if (!this.remove) {
      if (this.typeConfig.speedOffset) {
        speed += this.speedOffset
      }
      this.xPos -= Math.floor(((speed * FPS) / 1000) * deltaTime)

      // Update frame
      if (this.typeConfig.numFrames) {
        this.timer += deltaTime
        if (this.timer >= this.typeConfig.frameRate) {
          this.currentFrame =
            this.currentFrame == this.typeConfig.numFrames - 1
              ? 0
              : this.currentFrame + 1
          this.timer = 0
        }
      }
      this.draw()

      if (!this.isVisible()) {
        this.remove = true
      }
    }
  }

  /**
   * Calculate a random gap size.
   * - Minimum gap gets wider as speed increses
   * @param {number} gapCoefficient
   * @param {number} speed
   * @return {number} The gap size.
   */
  getGap(gapCoefficient, speed) {
    var minGap = Math.round(
      this.width * speed + this.typeConfig.minGap * gapCoefficient,
    )
    var maxGap = Math.round(minGap * Obstacle.MAX_GAP_COEFFICIENT)
    return getRandomNum(minGap, maxGap)
  }

  /**
   * Check if obstacle is visible.
   * @return {boolean} Whether the obstacle is in the game area.
   */
  isVisible() {
    return this.xPos + this.width > 0
  }

  /**
   * Make a copy of the collision boxes, since these will change based on
   * obstacle type and size.
   */
  cloneCollisionBoxes() {
    var collisionBoxes = this.typeConfig.collisionBoxes

    for (var i = collisionBoxes.length - 1; i >= 0; i--) {
      this.collisionBoxes[i] = new CollisionBox(
        collisionBoxes[i].x,
        collisionBoxes[i].y,
        collisionBoxes[i].width,
        collisionBoxes[i].height,
      )
    }
  }
}

/**
 * Coefficient for calculating the maximum gap.
 * @const
 */
Obstacle.MAX_GAP_COEFFICIENT = 1.5

/**
 * Maximum obstacle grouping count.
 * @const
 */
Obstacle.MAX_OBSTACLE_LENGTH = 3

/**
 * Obstacle definitions.
 * minGap: minimum pixel space betweeen obstacles.
 * multipleSpeed: Speed at which multiples are allowed.
 * speedOffset: speed faster / slower than the horizon.
 * minSpeed: Minimum speed which the obstacle can make an appearance.
 */
Obstacle.types = [
  {
    type: 'SMALL',
    width: 17,
    height: 35,
    yPos: 105,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 0, 17, 35)],
  },
  {
    type: 'BIG',
    width: 51,
    height: 35,
    yPos: 105,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 0, 51, 35)],
  },
  {
    type: 'MIDDLE',
    width: 34,
    height: 35,
    yPos: 105,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 0, 34, 35)],
  },
  {
    type: 'TALL_SMALL',
    width: 25,
    height: 50,
    yPos: 90,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 0, 25, 50)],
  },
  {
    type: 'TALL_MIDDLE',
    width: 50,
    height: 50,
    yPos: 90,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 0, 50, 50)],
  },
  {
    type: 'TALL_BIG',
    width: 75,
    height: 50,
    yPos: 90,
    multipleSpeed: 4,
    minGap: 120,
    minSpeed: 0,
    collisionBoxes: [new CollisionBox(0, 0, 75, 50)],
  },
]
