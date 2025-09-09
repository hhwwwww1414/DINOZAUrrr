import Runner from './js/runner.js'

async function setupSkinMenu(runner) {
  const btn = document.getElementById('skins-btn')
  const panel = document.getElementById('skins-panel')
  const selects = {
    character: document.getElementById('skin-select-character'),
    ground: document.getElementById('skin-select-ground'),
    obstacles: document.getElementById('skin-select-obstacles'),
  }
  const apply = document.getElementById('apply-skins')

  btn.addEventListener('click', () => panel.classList.toggle('hidden'))

  const res = await fetch('skins/skins.json')
  const data = await res.json()
  const saved = JSON.parse(localStorage.getItem('skinSelection') || '{}')

  for (const skin of data.skins) {
    const manifest = await fetch(`skins/${skin.id}/manifest.json`).then((r) =>
      r.json(),
    )
    if (manifest.character) {
      const opt = document.createElement('option')
      opt.value = skin.id
      opt.textContent = skin.name
      selects.character.appendChild(opt)
    }
    if (manifest.ground) {
      const opt = document.createElement('option')
      opt.value = skin.id
      opt.textContent = skin.name
      selects.ground.appendChild(opt)
    }
    if (manifest.obstacles) {
      const opt = document.createElement('option')
      opt.value = skin.id
      opt.textContent = skin.name
      selects.obstacles.appendChild(opt)
    }
  }

  selects.character.value = saved.character || ''
  selects.ground.value = saved.ground || ''
  selects.obstacles.value = saved.obstacles || ''

  apply.addEventListener('click', () => {
    runner.setSkin({
      character: selects.character.value || undefined,
      ground: selects.ground.value || undefined,
      obstacles: selects.obstacles.value || undefined,
    })
    panel.classList.add('hidden')
  })
}

function onDocumentLoad() {
  const runner = new Runner('.interstitial-wrapper')
  setupSkinMenu(runner)
}

document.addEventListener('DOMContentLoaded', onDocumentLoad)
