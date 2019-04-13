module.exports = {
  apps : [{
    name      : 'iptv-client',
    script    : 'client.js',
    log_type: 'json',
    log_file: 'iptv-client.log',
    out_file: 'out.log',
    error_file: 'error.log',
    env: {
      NODE_ENV: 'development',
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      SECONDARY_PUBLIC_IP_SERVICE: "http://ipinfo.io/json",
      GRAPHQL_ENDPOINT: 'ws://ws.iptv.tvstream.mx/api/socket',
      SCRIPT_VERSION: "1.0-test"
    },
    env_production : {
      NODE_ENV: 'production',
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      SECONDARY_PUBLIC_IP_SERVICE: "http://ipinfo.io/json",
      GRAPHQL_ENDPOINT: 'ws://ws.iptv.tvstream.mx/api/socket',
      SCRIPT_VERSION: "1.2.3"
    }
  },
  {
    name      : 'update_worker',
    script    : 'client_update.js',
    out_file: "/dev/null",
    error_file: "/dev/null",
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
      repo : 'http://159.89.43.103/tvstream/iptv-client.git',
      path: '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 startOrRestart ecosystem.config.js --env production --update-env'
    },
    development : {
      user : 'pi',
      host : 'localhost',
      ref  : 'origin/omx_without_dbus',
      repo : 'http://159.89.43.103/tvstream/iptv-client.git',
      path : '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 startOrRestart ecosystem.config.js --env production --update-env'
    }
  }
};
