import Runner from './js/runner.js'

async function listSkins() {
  try {
    const res = await fetch('skins/skins.json')
    if (res.ok) {
      const data = await res.json()
      return data.skins.map((s) => s.id)
    }
  } catch (e) {
    // ignore
  }

  const res = await fetch('skins/')
  const text = await res.text()
  const doc = new DOMParser().parseFromString(text, 'text/html')
  return Array.from(doc.querySelectorAll('a'))
    .map((a) => a.getAttribute('href'))
    .filter((h) => h && h.endsWith('/') && h !== '../')
    .map((h) => h.replace(/\/$/, ''))
    .filter((name) => name !== 'skins.json')
}

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

  const saved = JSON.parse(localStorage.getItem('skinSelection') || '{}')
  const ids = await listSkins()

  for (const id of ids) {
    const manifest = await fetch(`skins/${id}/manifest.json`).then((r) =>
      r.json(),
    )
    const name = manifest.name || id
    if (manifest.character) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = name
      selects.character.appendChild(opt)
    }
    if (manifest.ground) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = name
      selects.ground.appendChild(opt)
    }
    if (manifest.obstacles) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = name
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
