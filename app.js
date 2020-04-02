import Device from './device'
import shell from 'shelljs';
import ApiClient from './api_client';





const TENANT = process.env.TENANT
const MAC_ADDRESS = shell.cat("/sys/class/net/eth0/address").replace(/\n/g, '')
// const MAC_ADDRESS="b8:27:eb:41:f0:83"
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT
const PLATFORM = process.env.PLATFORM
const PUBLIC_IP_SERVICE = process.env.PUBLIC_IP_SERVICE
const SECONDARY_PUBLIC_IP_SERVICE = process.env.SECONDARY_PUBLIC_IP_SERVICE
const SCRIPT_VERSION = "1.3.5"

let apiClient = new ApiClient(GRAPHQL_ENDPOINT, MAC_ADDRESS)
let device = new Device({
  macAddress: MAC_ADDRESS,
  publicIpService: PUBLIC_IP_SERVICE,
  secondaryIpService: SECONDARY_PUBLIC_IP_SERVICE,
  scriptVersion: SCRIPT_VERSION,
  apiClient: apiClient
})



subscriptions()
device.apiClient.playbackPlayerMutation(PLATFORM)


function subscriptions(){
  //subscripcion para reproducir
  apiClient.subscribePlayback(function(params){
    if(params.error){
      shell.echo(params.error)
      apiClient.sendNotificationMutation("error", params.error)
      apiClient.createLogMutation("error", params.error)
    }
    else{
      device.player.play(params.url, opts)
      apiClient.createLogMutation("info", `url a reproducir: ${params.url}`)

    }
  })
  apiClient.subscribeExecuteAction(function(action){
    device.execute_cmd(action)
  })

}


const delay = ms => new Promise(res => setTimeout(res,ms))

async function infiniteStatus(){
  device.player.isPlayback(function(isActive){
    if(!isActive) {
      apiClient.playbackPlayerMutation(PLATFORM)
      apiClient.statusMutation("inactive")
    }
    else{
      apiClient.statusMutation("active")
    }
  })
  await delay(5000)
  await infiniteStatus()
}

async function infiniteDeviceProperties(){
  apiClient.updateDeviceMutation(device.getInfo())
  await delay(30 * 60000) //30 minutos
  await infiniteDeviceProperties()
}

async function restartDevice(){
  await delay(24 * 60 * 60000) // cada 24 hrs
  shell.exec("sudo reboot now")
}

async function flushLogs(){
  await await delay(22 * 60 * 60000) // cada 22 hrs
  shell.exec("pm2 flush")
}
infiniteDeviceProperties()
infiniteStatus()
restartDevice()
flushLogs()
