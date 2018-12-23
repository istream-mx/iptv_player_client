import gql from 'graphql-tag';
import {InMemoryCache} from "apollo-cache-inmemory";
import ApolloClient from 'apollo-client';
import * as AbsintheSocket from "@absinthe/socket";
import {createAbsintheSocketLink} from "@absinthe/socket-apollo-link";
import {Socket as PhoenixSocket} from "phoenix-channels";

function ApiClient(graphql_endpoint,tenant, macAddress){
  let link = createAbsintheSocketLink(AbsintheSocket.create(
    new PhoenixSocket(graphql_endpoint, {params: {mac_address: macAddress }})
  ));
  this.apolloClient =  new ApolloClient({
    link: link,
    cache: new InMemoryCache()
  });
  this.macAddress = macAddress
}


ApiClient.prototype.subscribePlayback = function subscribePlayback(callback){
  this.apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
    playback(macAddress: $macAddress){
      mac_address
      error
      url
      timeOut
    }
  }` , variables: { macAddress: this.macAddress}}).subscribe({
    next(data){
      let params = data.data.playback
      callback(params)
    }
  })
}


ApiClient.prototype.subscribeExecuteAction = function subscribeExecuteAction(callback){
  this.apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
    executeAction(macAddress: $macAddress)
  }` , variables: { macAddress: this.macAddress}}).subscribe({
    next(data){
      callback(data.data.executeAction)
    }})
}


ApiClient.prototype.sendNotificationMutation = function sendNotificationMutation(type,message){
  this.apolloClient.mutate({mutation: gql `mutation($input: InputDeviceNotification){
    notificationMessage(input: $input){
      type
  		message
  		playerDevice{
  			macAddress
  			ip
  			location
  			liveStreamId
  		}
    }
  }`, variables: {input: {playerDevice: {macAddress: this.macAddress}, type: type, message: message }}})
}

ApiClient.prototype.createLogMutation = function createLogMutation(type,message){
  this.apolloClient.mutate({mutation: gql `mutation($macAddress: String, $type: String, $message: String){
    createLog(macAddress: $macAddress, type: $type, message: $message){
      type
  		message
      macAddress

    }
  }`, variables: {macAddress: this.macAddress ,type: type, message: message }})
}

ApiClient.prototype.takeScreenshotMutation = function takeScreenshotMutation(imageUrl){
  this.apolloClient.mutate({mutation: gql `mutation($macAddress: String, $imageUrl: String){
    take_screenshot(macAddress: $macAddress, imageUrl: $imageUrl){
      macAddress
      imageUrl
      playerDevice{
        name
        macAddress
        crc
        location
      }
    }
  }`, variables: {macAddress: this.macAddress ,imageUrl: imageUrl}})
}


ApiClient.prototype.updateDeviceMutation = function updateDeviceMutation(playerDevice){
  this.apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
    updateDevice(input: $input){
      macAddress,
      name,
      location,
      ip
    }
  }`, variables: { input: playerDevice   }})
}

ApiClient.prototype.playbackPlayerMutation = function playbackPlayerMutation(platform){
  this.apolloClient.mutate({mutation: gql `mutation($macAddress: String!,$platform: String!){
      playbackLiveStream(macAddress: $macAddress, platform: $platform){
        macAddress
        url
        timeOut
        error
      }
    }`, variables: { macAddress: this.macAddress, platform: platform }
  })
}

ApiClient.prototype.statusMutation = function statusMutation(status){
  this.apolloClient.mutate({mutation: gql `mutation($input: InputDeviceStatus!){
    status(input: $input){
      status
      playerDevice{
        macAddress
        ip
        location
        liveStreamId
      }
    }
  }`, variables: { input: {playerDevice: {macAddress: this.macAddress}, status: status}     }})
}

ApiClient.prototype.speedTestMutation = function speedTestMutation(result){
  this.apolloClient.mutate({mutation: gql `mutation($macAddress: String!,$download: Float, $upload: Float){
      speedTest(macAddress: $macAddress, download: $download, upload: $upload){
        playerDevice{
    			name
    		}
    		download
    		upload
      }
    }`, variables: { macAddress: this.macAddress, upload: bitsToMegabits(result.upload), download: bitsToMegabits(result.download) }
  })
}

function bitsToMegabits(value){
  let mbps = value/(1048576)
  return Number(mbps.toFixed(2))
}

module.exports = ApiClient;
