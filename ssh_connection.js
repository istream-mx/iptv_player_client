"use strict";
import regeneratorRuntime from "regenerator-runtime";
require("babel-polyfill")
const ngrok = require('ngrok');
var token = "6ua79w4VxuxNRsKt5qwFp_79HU3YQCfTntUVWyoPKnr"



function SSHConection(apiClient){
  this.api_client = apiClient
}

SSHConection.prototype.create_tunnel_ssh = async function create_tunnel_ssh(){
  try {
    const url = await ngrok.connect({authtoken: token, proto: 'tcp', addr: 22})
    // this.api_client.TunnelSSHMutation(url)

  } catch (err) {
    this.api_client.sendNotificationMutation("info", "Ya existe una conexion con otro dispositivo")
  }
}

SSHConection.prototype.close_connection = async function close_connection(){
  try {
    await ngrok.disconnect()
  } catch (err) {
    console.log(err)
  }
}

module.exports = SSHConection;
