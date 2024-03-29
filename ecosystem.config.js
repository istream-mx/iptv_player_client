module.exports = {
  apps : [{
    name      : 'iptv-client',
    script    : 'client.js',
    log_type: 'json',
    env: {
      NODE_ENV: 'development',
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      SECONDARY_PUBLIC_IP_SERVICE: "http://ipinfo.io/json",
      GRAPHQL_ENDPOINT: 'ws://ws.iptv.tvstream.mx/api/socket'
    },
    env_production : {
      NODE_ENV: 'production',
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      SECONDARY_PUBLIC_IP_SERVICE: "http://ipinfo.io/json",
      GRAPHQL_ENDPOINT: 'ws://ws.iptv.tvstream.mx/api/socket'
    }
  },
  {
    name      : 'update_worker',
    script    : 'client_update.js',
    env_production : {
      NODE_ENV: 'production',
      PLATFORM: "raspberry",
      GRAPHQL_ENDPOINT: 'ws://ws.iptv.tvstream.mx/api/socket'
    },
    env: {
      NODE_ENV: 'development',
      PLATFORM: "raspberry",
      GRAPHQL_ENDPOINT: 'ws://ws.iptv.tvstream.mx/api/socket'
    }
  }
],

  deploy : {
    production : {
      user : 'pi',
      host : 'localhost',
      ref  : 'origin/master',
      repo : 'https://github.com/istream-mx/iptv_player_client.git',
      path: '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 startOrRestart ecosystem.config.js --env production --update-env'
    },
    development : {
      user : 'pi',
      host : 'localhost',
      ref  : 'origin/omx_without_dbus',
      repo : 'https://github.com/istream-mx/iptv_player_client.git',
      path : '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 startOrRestart ecosystem.config.js --env production --update-env'
    }
  }
};
