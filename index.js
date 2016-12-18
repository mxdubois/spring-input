var clamp = require('clamp')
var defined = require('defined')

var sign = function(x) {
  x = +x; // convert to a number
  if (x === 0 || isNaN(x)) {
    return Number(x);
  }
  return x > 0 ? 1 : -1;
}

module.exports = createSpringInput
function createSpringInput (opt) {
  return new SpringInput(opt)
}

function SpringInput (opt) {
  opt = opt || {}

  this.velocity = 0
  this.lastInput = 0
  this.interacting = false
  this.inputDelta = 0

  this.value = opt.value || 0
  this.min = opt.min || 0
  this.max = defined(opt.max, 1)
  this.edge = opt.edge || 0
  this.damping = defined(opt.damping, 0.3)
  this.maxVelocity = defined(opt.maxVelocity, 0.01)

  this.spring = defined(opt.spring, 0.2)

  // Default to zeros for backwards compatibility
  this.interactingSpring = defined(opt.interactingSpring, 0)
  this.tweenToInteractingMs = defined(opt.tweenToInteractingMs, 0)
  this.tweenToFreeMs = defined(opt.tweenToFreeMs, 0)

  this.activeSpring = this.spring
}

SpringInput.prototype.update = function () {
  var isBefore = this.value < this.min
  var isAfter = this.value > this.max
  var dip = 0

  // Ease between springs
  var tweenMs = this.interacting ? this.tweenToInteractingMs : this.tweenToFreeMs
  var numTweenSteps = Math.max(1, tweenMs / 16) // assume 16 fps
  var springTweenStep = Math.abs(this.spring - this.interactingSpring) / numTweenSteps
  var targetSpring = this.interacting ? this.interactingSpring : this.spring
  var targetDirection = sign(targetSpring - this.activeSpring)
  if (this.activeSpring !== targetSpring) {
    var tweenedSpring = this.activeSpring + targetDirection * springTweenStep
    this.activeSpring = clamp(tweenedSpring, 0, targetSpring)
  }

  // ease input at edges
  if (isBefore) {
    this.velocity = 0
    if (this.inputDelta < 0 && this.edge !== 0) {
      this.inputDelta *= 1 - Math.abs(this.value - this.min) / this.edge
    }
  } else if (isAfter) {
    this.velocity = 0
    if (this.inputDelta > 0 && this.edge !== 0) {
      this.inputDelta *= 1 - Math.abs(this.value - this.max) / this.edge
    }
  }

  // dip back to edge
  if (isBefore) {
    dip = this.value - this.min
  } else if (isAfter) {
    dip = this.value - this.max
  }
  dip *= this.activeSpring

  // integrate
  this.value += this.inputDelta
  this.inputDelta = 0
  if (!this.interacting) {
    this.value += this.velocity
  }
  this.velocity *= 1 - this.damping
  this.value -= dip
  this.value = clamp(this.value, this.min - this.edge, this.max + this.edge)

  this.value += (this.interacting ? 0 : this.velocity) + this.inputDelta - dip
  // 1. Don't cannibalize the user input velocity
  // 2. Only apply damping when the velocity is opposed to the spring force
  if (!this.interacting && dip !== 0 && sign(this.velocity) !== sign(-1 * dip)) {
    this.velocity *= 1 - this.damping
  }

  this.inputDelta = 0
  this.value = clamp(this.value, this.min - this.edge, this.max + this.edge)
}

SpringInput.prototype.start = function (value) {
  this.interacting = true
  this.velocity = 0
  this.inputDelta = 0
  this.lastInput = value
}

SpringInput.prototype.move = function (value) {
  if (this.interacting) {
    var delta = value - this.lastInput
    // avoid getting out of sync when user is at gutter
    if (this.value + delta > this.max + this.edge) {
      value = Math.min(value, this.max + this.edge)
    }
    if (this.value + delta < this.min - this.edge) {
      value = Math.max(value, this.min - this.edge)
    }
    this.inputDelta = delta
    this.lastInput = value

    // clamp to max velocity
    var maxVelocity = Math.abs(this.maxVelocity)
    if (this.inputDelta < 0) {
      this.velocity = Math.max(this.velocity + this.inputDelta, -maxVelocity)
    } else if (this.inputDelta > 0) {
      this.velocity = Math.min(this.velocity + this.inputDelta, maxVelocity)
    }
  }
}

SpringInput.prototype.end = function () {
  this.interacting = false
}
