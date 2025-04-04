import * as a from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/all.mjs'
import * as o from 'https://cdn.jsdelivr.net/npm/@mitranim/js@0.1.62/obs.mjs'
import * as f from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js'
import * as fa from 'https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js'
import * as u from './util.mjs'

const conf = await (await a.resOk(fetch(`/js/firebase.json`))).json()
const app = f.initializeApp(conf)
const auth = fa.getAuth(app)
const db = fs.getFirestore(app)
const state = o.obs({user: undefined})

fa.onAuthStateChanged(auth, function onAuthChange(user) {
  u.log.info(`auth state changed:`, user)
  state.user = user
})

async function loginAnon() {
  try {
    await fa.signInAnonymously(auth)
    u.log.info(`logged in anonymously`)
  }
  catch (err) {
    u.log.err(`unable to login anonymously:`, err)
  }
}

async function loginGoogle() {
  try {
    const provider = new fa.GoogleAuthProvider()
    await fa.signInWithPopup(auth, provider)
    u.log.info(`logged in with Google`)
  }
  catch (err) {
    u.log.err(`unable to login with Google:`, err)
  }
}

async function logout() {
  try {
    await fa.signOut(auth)
    u.log.info(`logged out`)
  }
  catch (err) {
    u.log.err(`unable to logout:`, err)
  }
}
