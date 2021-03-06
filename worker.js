if(process.env.NEW_RELIC_LICENSE_KEY) require('newrelic')

var bparser  = require('body-parser')
var cookie   = require('cookie-parser')
var express  = require('express')
var favicon  = require('serve-favicon')
var fs       = require('fs')
var log4js   = require('log4js')
var minify   = require('express-minify')
var op       = require('object-path')
var path     = require('path')
var random   = require('randomstring')
var raven    = require('raven')

var i18n     = require('./helpers/i18n')
var core_api = require('./helpers/core-api')
var entu     = require('./helpers/entu')



// global variables (and list of all used environment variables)
APP_VERSION         = process.env.VERSION || require('./package').version
APP_LOGLEVEL        = process.env.LOGLEVEL || 'info'
APP_PORT            = process.env.PORT
APP_CACHE_DIR       = process.env.CACHEDIR || path.join(__dirname, 'cache')
APP_COOKIE_SECRET   = process.env.COOKIE_SECRET || random.generate(16)
APP_ENTU_URL        = process.env.ENTU_URL || 'https://helpific.entu.ee/api2'
APP_ENTU_USER       = process.env.ENTU_USER
APP_ENTU_KEY        = process.env.ENTU_KEY
APP_SENTRY          = process.env.SENTRY_DSN
APP_DEFAULT_LOCALE  = process.env.DEFAULT_LOCALE || 'en'
APP_TIMEZONE        = process.env.TIMEZONE || 'Europe/Tallinn'
APP_ADMIN_EMAILS    = process.env.ADMIN_EMAILS
APP_FEEDBACK_EMAILS = process.env.FEEDBACK_EMAILS
APP_CORE_URL        = process.env.CORE_URL || 'http://core.helpific.ee:8080'
APP_AUTH_CORE_URL   = process.env.AUTH_CORE_URL || 'https://core.helpific.ee'
APP_SIGNIN_PORT     = process.env.SIGNIN_PORT || 443


log4js.configure({
    "appenders": [
        {
              type: "console"
            , category: "all"
        },
        {
            "type": "file",
            "filename": "/var/log/helpific/helpific.log",
            "maxLogSize": 50000000,
            "backups": 10,
            "category": "all"
        }
    ]
});


// start logging
log = log4js.getLogger('all')
log.setLevel(APP_LOGLEVEL)


// ensure cache directory exists
fs.existsSync(APP_CACHE_DIR) || fs.mkdirSync(APP_CACHE_DIR)

// This will add the well-known CAs
// to `https.globalAgent.options.ca`
require('ssl-root-cas/latest')
    .inject()
    .addFile(__dirname + '/ssl-ca/AddTrustExternalCARoot.crt')
    .addFile(__dirname + '/ssl-ca/COMODORSAAddTrustCA.crt')
    .addFile(__dirname + '/ssl-ca/COMODORSADomainValidationSecureServerCA.crt')
;

// Configure i18n
i18n.configure({
    locales: ['en', 'et', 'fi', 'cs', 'fr', 'ru', 'hu', 'de', 'ko', 'zh', 'ja', 'it', 'el', 'lt', 'lv', 'nl'],
    defaultLocale: APP_DEFAULT_LOCALE,
    file: path.join(__dirname, 'locales.yaml'),
    updateFile: true,
    countries:  {
        'ee': 'et',
        'ru': 'ru',
        'hu': 'hu',
        'de': 'de',
        'kr': 'ko',
        'jp': 'ja',
        'cn': 'zh',
        'it': 'it',
        'fi': 'fi',
        'fr': 'fr',
        'lv': 'lv',
        'lt': 'lt',
        'el': 'el',
        'nl': 'nl'
    }
})



// initialize getsentry.com client
var ravenClient = new raven.Client({
    release: APP_VERSION,
    dataCallback: function(data) {
        delete data.request.env
        return data
    }
})



// start express app
function isProfileAcceptable(user) {
    return (op.get(user, 'person.properties.forename.values.0.value', '') != null &&
    op.get(user, 'person.properties.email.values.0.value', '') != null &&
    op.get(user, 'person.properties.town.values.0.value', '') != null &&
    op.get(user, 'person.properties.country.values.0.value', '') != null &&
    op.get(user, 'person.properties.forename.values.0.value', '').length > 0 &&
    op.get(user, 'person.properties.email.values.0.value', '').length > 0 &&
    op.get(user, 'person.properties.town.values.0.value', '').length > 0 &&
    op.get(user, 'person.properties.country.values.0.value', '').length > 0);
}

express()
    // get correct client IP behind nginx
    .set('trust proxy', true)

    // jade view engine
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'jade')

    // logs to getsentry.com - start
    .use(raven.middleware.express.requestHandler(ravenClient))

    // cookies
    .use(cookie(APP_COOKIE_SECRET))

    // parse POST requests
    .use(bparser.json())
    .use(bparser.urlencoded({extended: true}))

    // use express-minify to minify css/js
    .use(minify({
        js_match: /javascript/,
        stylus_match: /stylus/,
        json_match: /do_not_cache_json/,
        cache: APP_CACHE_DIR
    }))

    // static files path & favicon
    .use(express.static(path.join(__dirname, 'public')))
    .use(favicon(path.join(__dirname, 'public', 'images', 'helpific-logo.ico')))

    // redirects
    .use('/piiridetaelu', function(req, res) {
        res.redirect('/et/bb')
    })

    // redirects
    .use('/positiivse-suhtumise-arendamine', function(req, res) {
        res.redirect('/et/pad')
    })

    // redirects
    .use('/positive-attitude-development', function(req, res) {
        res.redirect('/en/pad')
    })


    // redirects
    .use('/razvitie-pozitivnogo-otnoshenija', function(req, res) {
        res.redirect('/ru/pad')
    })

    // set defaults for views
    .use(function(req, res, next) {
        res.authenticate = function() {
            if(!res.locals.user) {
                res.cookie('redirect_url', '/' + res.locals.path.split('/').slice(2).join('/'), {signed:true, maxAge:1000*60*60})
                res.redirect('/' + res.locals.lang + '/signin')
                return false
            } else {

                var path = res.locals.path.split('/').slice(2).join('/');
                log.debug('path = ' + path)
                if(path == 'contact' || path == 'profile'){
                    return true
                } else {
                    log.debug(JSON.stringify(res.locals.user))
                    if(res.locals.user.profileAcceptable) {
                        return true
                    } else {
                        res.redirect('/' + res.locals.lang + '/contact')
                    }
                }
            }
        }

        res.locals.showFeedback = true
        res.locals.path = req.path
        if(!req.signedCookies) next(null)
        if(req.signedCookies.auth_id && req.signedCookies.auth_token) {
            entu.getUser({
                auth_id: req.signedCookies.auth_id,
                auth_token: req.signedCookies.auth_token
            }, function(error, user) {
                if(user) {
                    res.locals.user = {
                        id: parseInt(req.signedCookies.auth_id, 10),
                        token: req.signedCookies.auth_token,
                        picture: op.get(user, 'picture'),
                        lang: op.get(user, 'person.language.values.0.value', APP_DEFAULT_LOCALE),
                        forename: op.get(user, 'person.properties.forename.values.0.value'),
                        profileAcceptable: isProfileAcceptable(user)
                    }
                } else {
                    res.clearCookie('auth_id')
                    res.clearCookie('auth_token')
                }
                next(null)
            })
        } else {
            next(null)
        }
    })

    // redirect to pages with language selected
    .use('/help/requests', function(req, res) {
        res.redirect('/:lang/help/requests')
    })
    .use('/help/offers', function(req, res) {
        res.redirect('/:lang/help/offers')
    })
    .use('/messages', function(req, res) {
        res.redirect('/:lang/messages')
    })

    .use('/profile', function(req, res) {
        res.redirect('/:lang/profile')
    })
    .use('/contact', function(req, res) {
        res.redirect('/:lang/contact')
    })
    .use('/signin', function(req, res) {
        res.redirect('/:lang/signin')
    })
    .use('/users', function(req, res) {
        res.redirect('/:lang/users')
    })

    // initiate i18n
    .use(i18n.init)

    // routes mapping
    .use('/:lang',          require('./routes/index'))
    .use('/:lang/help',     require('./routes/help'))
    .use('/:lang/messages', require('./routes/messages'))
    .use('/:lang/profile',  require('./routes/profile'))
    .use('/:lang/contact',  require('./routes/contact'))
    .use('/:lang/signin',   require('./routes/signin'))
    .use('/:lang/users',    require('./routes/users'))
    .use('/:lang/tr',       require('./routes/tr'))

    // logs to getsentry.com - error
    .use(raven.middleware.express.errorHandler(ravenClient))

    // show 404
    .use(function(req, res) {
        res.render('error', {
            title: 404,
            message: '',
            error: {}
        })
    })

    // show error
    .use(function(err, req, res) {
        log.error(err)

        res.render('error', {
            message: err.message,
            error: APP_LOGLEVEL === 'debug' ? err : {}
        })
    })

    // start servers if ports are set
    .listen(APP_PORT, function() {
        log.info('Started listening port ' + APP_PORT)
    })
