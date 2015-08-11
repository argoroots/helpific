var fs    = require('fs')
var path  = require('path')
var yaml  = require('js-yaml')
var op    = require('object-path')
var debug = require('debug')('app:' + path.basename(__filename).replace('.js', ''))

var i18n_config = {}



exports.configure = function(config) {
    if(!config) config = {}

    i18n_config.file = config.file || path.join(__dirname, 'locales.yaml')
    i18n_config.locales = config.locales || ['en']
    i18n_config.defaultLocale = config.defaultLocale || 'en'
    i18n_config.updateFile = config.updateFile || false

    i18n_config.translations = {}
    if(fs.existsSync(i18n_config.file)) i18n_config.translations = yaml.safeLoad(fs.readFileSync(i18n_config.file))
}



exports.init = function(req, res, next) {
    i18n_config.lang = req.path.split('/')[1] || i18n_config.defaultLocale

    res.locals.lang = i18n_config.lang
    res.locals.t = translate

    next()
}



exports.translate = translate
function translate(key) {
    var value = op.get(i18n_config, 'translations.' + key + '.' + i18n_config.lang)
    if(!value && i18n_config.updateFile === true && i18n_config.locales.indexOf(i18n_config.lang) > -1) {
        op.set(i18n_config, 'translations.' + key + '.' + i18n_config.lang, key)

        fs.writeFile(i18n_config.file, yaml.safeDump(i18n_config.translations, { sortKeys: true }), function(err) {
            if(err) return console.log(err)
        })
    }
    return value || key
}
