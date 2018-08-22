module.exports = {
  apps : [{
    name      : 'iptv-client',
    script    : 'client.js',
    env: {
      NODE_ENV: 'development',
      TENANT: "dGVzdA==",
      SLUG: "canal6",
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      GRAPHQL_ENDPOINT: 'ws://localhost:4000/api/socket',
      LIVE_STREAM_ID: 1
    },
    env_production : {
      NODE_ENV: 'production',
      TENANT: "Y2FuYWw2",
      SLUG: "canal6",
      PLATFORM: "raspberry",
      PUBLIC_IP_SERVICE: "http://ip-api.com/json",
      GRAPHQL_ENDPOINT: 'ws://canal6.iptv.tvstream.mx/api/socket',
      LIVE_STREAM_ID: 1
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
      path : '/Users/joss/Documents/production',
      'post-deploy' : 'yarn && pm2 reload ecosystem.config.js --env development'
    }
  }
};
