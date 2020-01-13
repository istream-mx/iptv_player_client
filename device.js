
import shell from 'shelljs';
import ip from 'ip'
import speedTest from 'speedtest-net';
import SSHConection from './ssh_connection'

class Device {
  constructor(args) {
    this.macAddress = args.macAddress;
    this.publicIpService = args.publicIpService
    this.secondaryIpService = args.secondaryIpService
    this.scriptVersion = args.scriptVersion
    this.apiClient = args.apiClient,
    this.player = args.player,
    this.sshConnection = new SSHConection(args.apiClient)
  }

  getInfo(){
    let ip_details ={}
    let teamviewerId = this.getTeamviewerId()
    try {
      ip_details = JSON.parse(shell.exec(`curl -s ${this.publicIpService}`, {silent:true}).stdout)
      return {
        macAddress: this.macAddress,
        scriptVersion: this.scriptVersion,
        ip: `${ip_details.query}/${ip.address()}`,
        location: `${ip_details.countryCode}-${ip_details.city}-${ip_details.regionName}-${ip_details.timezone}`,
        teamviewerId: teamviewerId
      }
    }
    catch(err) {
      console.error(err)
    }
    if(!ip_details.city){
      try {
          ip_details = JSON.parse(shell.exec(`curl -s ${this.secondaryIpService}`, {silent:true}).stdout)
          return {
            macAddress: this.macAddress,
            ip: `${ip_details.ip}/${ip.address()}`,
            location: `${ip_details.country}-${ip_details.city}-${ip_details.region}`,
            teamviewerId: teamviewerId,
            scriptVersion: this.scriptVersion
        }
      }
        catch (err) {
          console.error(err)
        }
      }
    else{
      return {
        macAddress: this.macAddress,
        teamviewerId: teamviewerId,
        scriptVersion: this.scriptVersion
      }
    }
  }

  getTeamviewerId(){
    if(!shell.which('teamviewer')){
      return ""
    }
    else {
      let command = "teamviewer info | grep 'TeamViewer ID:' | grep -oE '[0-9]{5,10}' "
      let id = shell.exec(command, {silent: true}).stdout
      return id
    }
  }

  speedTest(){
    let vm = this
    let reboot = false
    if (!shell.which('speedtest-cli')){
      shell.exec("sudo mount -o remount,rw /")
      shell.exec("sudo apt install speedtest-cli")
      reboot = true
    }
    let child_speed = shell.exec("speedtest-cli --json", function(code, stdout, stderr){
      if(code != 0) this.apiClient.createLogMutation("error", stderr)
      else {
        vm.apiClient.speedTestMutation(JSON.parse(stdout))
      }
      if (reboot) shell.exec("sudo reboot now")
    });
  }

  screenShot(){
    let vm = this
    let reboot = false
    if (!shell.which('raspi2png')) {
      shell.exec("sudo mount -o remount,rw /")
      shell.echo('Instalando raspi2png');
      shell.exec("curl -sL https://raw.githubusercontent.com/AndrewFromMelbourne/raspi2png/master/installer.sh | bash -")
      reboot = true
    }
    shell.exec("raspi2png -p /tmp/screenshot.png")
    shell.exec("curl --upload-file /tmp/screenshot.png https://transfer.sh/screenshot.png", function(code,stout,stderr){
      vm.apiClient.takeScreenshotMutation(stout)
      if (reboot) shell.exec("sudo reboot now")
    })
  }

  update(){
    shell.exec("sudo mount -o remount,rw /")
    shell.exec("rm -rf /home/pi/Documents/production/source/.git/index.lock")
    shell.exec("cd /home/pi/Documents/production/current && git reset --hard")
    let vm = this
    shell.exec("pm2 deploy ecosystem.config.js production --force",function(code, stdout, stderr) {
      if(code != 0){
        vm.apiClient.sendNotificationMutation("error", `Error al actualizar ${stderr}`)
        vm.apiClient.createLogMutation("error", `Error al actualizar ${stderr}`)
        console.error(stderr)
        shell.exec("sudo reboot now")
      }
      else {
        console.log("se actualizo correctamente la aplicacion.")
        vm.apiClient.createLogMutation("success", "Se actualizo correctamente el dispositivo.")
        shell.exec("sudo reboot now")
      }
    })
  }

  restart(){
    shell.exec("sudo mount -o remount, rw /")
    shell.exec("sudo teamviewer passwd 9981532121")
    this.apiClient.sendNotificationMutation("info", "Se reinicio el receptor correctamente.")
    shell.exec('sudo reboot now' )
  }

  execute_cmd(action){
    switch (action) {
      case "restart":
        this.restart()
        break;

      case "stop":
        this.player.stop()
        break;

      case "updateApp":
        shell.exec("pm2 start ecosystem.config.js --only update_worker --env production",{silent: true})
        this.apiClient.sendNotificationMutation("info", "configurando es startup")
        shell.exec('pm2 save',{silent: true})
        this.update()//eliminar el case despues de actualizar
        break;

      case "upUpdateService":
        shell.exec("pm2 start ecosystem.config.js --only update_worker --env production")
        break;
      case "takeScreenshot":
        this.screenShot()
        break;
      case "speedTest":
        this.speedTest()
        break;
      case "ssh-connection":
        this.sshConnection.create_tunnel_ssh()
        break;
      case "close-connection":
          this.sshConnection.close_connection()
        break;

      default:
        // if(action != "update") device.apiClient.sendNotificationMutation("error", "Accion no implementada")
        break;
    }
  }

}



module.exports = Device;
