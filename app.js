'use strict'
const https = require('https')

function equalSets(a, b) {
  return a.size === b.size && [...a].every(e => b.has(e))
}

class SteamListener {
  constructor(steamKey, steamIds, callback) {
    this.callback = callback
    this.URL = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamKey}&steamids=${steamIds}`
  }

  request() {
    let cb = this.callback
    https.get(this.URL, (res) => {
      let data = ''
      res.on('data', (d) => {
        data += d
      })
      res.on('end', () => {
        let json = JSON.parse(data)
        cb(json)
      })
    }).on('error', (e) => {
      console.log(e)
    })
  }

  listen() {
    let repeat = () => {
      this.request()
      setTimeout(() => {
        repeat()
      }, 20000)
    }
    repeat()
  }
}

class GroupmeMessager {
  constructor(botID) {
    this.botID = botID
  }

  createMessage(playing) {
    let message = playing.join(', ')
    if (playing.length < 2) {
      message += ' is '
    }
    else {
      message += ' are '
    }
    message += 'playing Rocket League'
    return message
  }

  sendPlayingMessage(playing) {
    let options = {
      hostname: 'api.groupme.com',
      path: '/v3/bots/post',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }
    let req = https.request(options, (res) => {
      res.on('data', (d) => {
        console.log('' + d)
      })
    })
    req.on('error', (e) => {
      console.log(e)
    })
    req.write(String.raw`{"text": "${this.createMessage(playing)}", "bot_id": "${this.botID}"`)
    req.end()
  }
}

class OnlinePlayers {
  constructor() {
    this.online = new Set()
  }

  refreshOnline(online) {
    let newOnlinePlayers = new Set(online.filter((player) => {
      return !this.online.has(player)
    }))
    this.online = new Set(online)
    return newOnlinePlayers
  }
}

class Controller {
  constructor(steamKey, steamIDs, gameId, botId) {
    this.gameId = gameId
    this.onlinePlayers = new OnlinePlayers()
    this.groupmeMessager = new GroupmeMessager(botId)
    this.previousMessagePlayers = new Set()
    this.steamListener = new SteamListener(steamKey, steamIDs, (json) => {
      let playing = this.getUsersPlaying(json)
      let newPlaying = this.onlinePlayers.refreshOnline(playing)
      if (newPlaying.size > 0 && !equalSets(this.previousMessagePlayers, newPlaying)) {
        this.groupmeMessager.sendPlayingMessage(playing)
        // Quick fix to prevent spamming messages - should nest this line in a callback
        // to the above message. also, race conditions need to be handled above, in the
        // case of many messages trying to be sent at once. This fix will work for now.
        this.previousMessagePlayers = playing
      }
    })
  }

  getUsersPlaying(json) {
    return json['response']['players'].filter((player) => {
        return player['gameid'] === this.gameId
      }).map((player) => {
        return player['personaname']
      })
  }

  begin() {
    this.steamListener.listen()
  }
}

const steamKey = process.env.STEAM_KEY
const steamIds = process.env.STEAM_IDS
const gameId = process.env.GAME_ID
const botId = process.env.BOT_ID

if (!steamKey || !steamIds || !gameId || !botId) {
  console.log(process.env)
  throw 'Environment variables not set'
}

new Controller(steamKey, steamIds, gameId, botId).begin()
