module.exports = {
  apps : [{
    name      : 'iptv-client',
    script    : 'client.js',
    env: {
      NODE_ENV: 'development',
      TENANT: "dGVzdA==",
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      GRAPHQL_ENDPOINT: 'ws://192.168.50.114:4000/api/socket'
    },
    env_production : {
      NODE_ENV: 'production',
      TENANT: "Y2FuYWw2",
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      GRAPHQL_ENDPOINT: 'ws://canal6.iptv.tvstream.mx/api/socket'
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
      host : '192.168.50.177',
      ref  : 'origin/fix_omxplayer',
      repo : 'http://159.89.43.103/tvstream/iptv-client.git',
      path : '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 reload ecosystem.config.js'
    }
  }
};
