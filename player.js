
import shell from 'shelljs';


function Player(options){
  this.player = "omxplayer";
  this.args = parse_args(options);

}

Player.prototype.play(url, options){
  shell.exec(`${this.player} ${this.args} ${url}`, {async:true})
}

Player.prototype.stop(){
  shell.exec('sudo killall -s 9 omxplayer')
  shell.exec('sudo killall -s 9 omxplayer.bin')
}

var parse_args = function (options){
  let args = ""
  if(["hdmi", "local", "both"].indexOf(options.audioOutput) != -1)
    args.push(`-o ${options.audioOutput}`)
  if (options.blackBackground !== false)
    args.push('-b');
  if (options.disableKeys === true)
    args.push('--no-keys');
  if (settings.disableGhostbox === true)
    args.push('--no-ghost-box');
  if (options.disableOnScreenDisplay === true)
    args.push('--no-osd')
  if(options.startVolume >= 0 && options.startVolume <= 1.0){
    var vol = calculete_volume(options.startVolume)
    args.push(`--vol ${vol}`)
  }
  return args.join(" ")

}


var calculete_volume(startVolume){
  var vol = startVolume > 0 ? Math.round(100 * 20 * (Math.log(startVolume) / Math.log(10))) / 1 : -12000000;
  return vol
}


module.exports = Player;
