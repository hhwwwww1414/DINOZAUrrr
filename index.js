import Runner from './js/runner.js'

/**
 * Main logic of this runner game
 * @date 2024/04/20
 */

function onDocumentLoad() {
  new Runner('.interstitial-wrapper')
}

document.addEventListener('DOMContentLoaded', onDocumentLoad)
