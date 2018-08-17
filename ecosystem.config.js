module.exports = {
  apps : [{
    name      : 'iptv-client',
    script    : 'client.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production : {
      NODE_ENV: 'production'
    }
  }],

  deploy : {
    production : {
      user : 'pi',
      host : 'localhost',
      ref  : 'origin/subscriptions',
      repo : 'http://159.89.43.103/tvstream/iptv-client.git',
      //path : '/Users/joss/Documents/production',
      path: '/home/pi/Documents/production',
      'post-deploy' : 'yarn && pm2 reload ecosystem.config.js --env production'
    }
  }
};
