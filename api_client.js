import gql from 'graphql-tag';
import {InMemoryCache} from "apollo-cache-inmemory";
import ApolloClient from 'apollo-client';
import * as AbsintheSocket from "@absinthe/socket";
import {createAbsintheSocketLink} from "@absinthe/socket-apollo-link";
import {Socket as PhoenixSocket} from "phoenix-channels";

class ApiClient {
  constructor(graphql_endpoint, macAddress) {
    let link = createAbsintheSocketLink(AbsintheSocket.create(
      new PhoenixSocket(graphql_endpoint, {params: {mac_address: macAddress }})
    ));
    this.apolloClient =  new ApolloClient({
      link: link,
      cache: new InMemoryCache()
    });
    this.macAddress = macAddress
  }

  getPlayerConfiguration(callback){
    this.apolloClient.query({ query: gql `query($macAddress: String!){
      device(macAddress: $macAddress){
        mac_address
        config
        name
      }
    }`, variables: { macAddress: this.macAddress}})
    .then(data => {
      callback(data.data)
    })
  }

  subscribePlayback(callback){
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

  subscribeExecuteAction(callback){
    this.apolloClient.subscribe({query:  gql `subscription($macAddress: String!){
      executeAction(macAddress: $macAddress)
    }` , variables: { macAddress: this.macAddress}}).subscribe({
      next(data){
        callback(data.data.executeAction)
      }})
  }


  sendNotificationMutation(type,message){
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

  createLogMutation(type,message){
    this.apolloClient.mutate({mutation: gql `mutation($macAddress: String, $type: String, $message: String){
      createLog(macAddress: $macAddress, type: $type, message: $message){
        type
    		message
        macAddress

      }
    }`, variables: {macAddress: this.macAddress ,type: type, message: message }})
  }

  takeScreenshotMutation(imageUrl){
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


  updateDeviceMutation(playerDevice){
    this.apolloClient.mutate({mutation: gql `mutation($input: InputPlayerDevice!){
      updateDevice(input: $input){
        macAddress,
        name,
        location,
        ip
      }
    }`, variables: { input: playerDevice   }})
  }

  playbackPlayerMutation(platform){
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

  statusMutation(status){
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

  speedTestMutation(result){
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

  TunnelSSHMutation(url){
    this.apolloClient.mutate({mutation: gql `mutation($url: String!){
        tunnelSSH(url: $url){
          url
        }
      }`, variables: { url: url }
    })
  }
}


function bitsToMegabits(value){
  let mbps = value/(1048576)
  return Number(mbps.toFixed(2))
}

module.exports = ApiClient;
