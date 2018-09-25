module.exports = {
  apps : [{
    name      : 'iptv-client',
    script    : 'client.js',
    log_type: 'json',
    env: {
      NODE_ENV: 'development',
      TENANT: "Y2FuYWw2",
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      SECONDARY_PUBLIC_IP_SERVICE: "http://ipinfo.io/json",
      GRAPHQL_ENDPOINT: 'ws://canal6.iptv.tvstream.mx/api/socket',
      SCRIPT_VERSION: "1.0-test"
    },
    env_production : {
      NODE_ENV: 'production',
      TENANT: "Y2FuYWw2",
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      SECONDARY_PUBLIC_IP_SERVICE: "http://ipinfo.io/json",
      GRAPHQL_ENDPOINT: 'ws://canal6.iptv.tvstream.mx/api/socket',
      SCRIPT_VERSION: "1.0.1"
    }
  }],

  deploy : {
    production : {
      user : 'pi',
      host : 'localhost',
      ref  : 'origin/master',
      repo : 'http://159.89.43.103/tvstream/iptv-client.git',
      path: '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 reload ecosystem.config.js --env production'
    },
    development : {
      user : 'pi',
      host : 'localhost',
      ref  : 'origin/develop',
      repo : 'http://159.89.43.103/tvstream/iptv-client.git',
      path : '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 reload ecosystem.config.js'
    }
  }
};
