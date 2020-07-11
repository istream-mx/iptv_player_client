import shell from 'shelljs';


class Player {
  constructor(apiClient) {
    this.player = "omxplayer";
    let wm = this
    apiClient.getPlayerConfiguration(function(data) {
      let args = parse_args(data.device.playerConfig);
      wm.args = args
    })
    
    
  }

  play(url){
    this.stop()
    shell.exec(`${this.player} ${this.args} ${url}`, {async:true})
  }
  stop(){
    this.isPlayback(function(playing){
      if(playing){
        shell.exec('sudo killall -s 9 omxplayer')
        shell.exec('sudo killall -s 9 omxplayer.bin')
      }
    })
  }
  isPlayback(callback){
    let process = shell.exec('ps -A | grep -c omxplayer',{silent:true}).stdout.replace(/\n/g, '')
    if(process > 0) callback(true)
    else callback(false)
  }
}

var parse_args = function (options){
  options = setDefaultValues(options)
  let args = []
  if(["hdmi", "local", "both"].indexOf(options.audioOutput) != -1)
    args.push(`-o ${options.audioOutput}`)
  if (options.blackBackground !== false)
    args.push('-b');
  if (options.disableKeys === true)
    args.push('--no-keys');
  if (options.disableGhostbox === true)
    args.push('--no-ghost-box');
  if (options.disableOnScreenDisplay === true)
    args.push('--no-osd')
  if(options.startVolume >= 0 && options.startVolume <= 1.0){
    var vol = calculete_volume(options.startVolume)
    args.push(`--vol ${vol}`)
  }
  return args.join(" ")

}

var setDefaultValues = function(opts){
  opts["audioOutput"] = opts["audioOutput"] || "local"
  opts["blackBackground"] = opts["blackBackground"] || true
  opts["disableKeys"] = opts["disableKeys"] || true
  opts["disableGhostbox"] = opts["disableGhostbox"] || true
  opts["disableOnScreenDisplay"] = opts["disableOnScreenDisplay"] || true
  opts["startVolume"] = opts["startVolume"] || 1.0
  opts["closeOtherPlayers"] = true
  return opts
}


var calculete_volume = function(startVolume){
  var vol = startVolume > 0 ? Math.round(100 * 20 * (Math.log(startVolume) / Math.log(10))) / 1 : -12000000;
  return vol
}


module.exports = Player;
