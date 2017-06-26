'use strict'
const https = require('https')
const config = require('./config.js')

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
    req.end();
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
    this.steamListener = new SteamListener(steamKey, steamIDs, (json) => {
      let playing = this.getUsersPlaying(json)
      let newPlaying = this.onlinePlayers.refreshOnline(playing)
      if (newPlaying.size > 0) {
        this.groupmeMessager.sendPlayingMessage(playing)
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

new Controller(
  config['steamKey'],
  config['steamIds'],
  config['gameId'],
  config['botId']).begin()
