PATH = location.pathname.split('/')
LANGUAGE = PATH[1]



angular.module('hlpfc', [])



// INDEX
    .controller('indexCtrl', ['$scope', '$http', function($scope, $http) {
        $http({
                method : 'GET',
                url    : '/' + LANGUAGE + '/json/index'
            })
            .success(function(data) {
                console.log(data);
                $scope.info = data
            })
    }])



// HELP
    .controller('helpCtrl', ['$scope', '$http', function($scope, $http) {
        if(PATH[3] === 'requests') $scope.type = 'request'
        if(PATH[3] === 'offers') $scope.type = 'offer'

        $http({
                method : 'GET',
                url    : '/' + LANGUAGE + '/json/help/statuses'
            })
            .success(function(data) {
                $scope.statuses = data
            })

        $http({
                method : 'GET',
                url    : '/' + LANGUAGE + '/json/help'
            })
            .success(function(data) {
                $scope.help = data
            })
    }])



// USERS
    .controller('usersCtrl', ['$scope', '$http', function($scope, $http) {
        $http({
                method : 'GET',
                url    : '/' + LANGUAGE + '/json/users'
            })
            .success(function(data) {
                $scope.users = data
            })
    }])



// USER
    .controller('userCtrl', ['$scope', '$http', function($scope, $http) {
        $scope.id = PATH[3]
        $http({
                method : 'GET',
                url    : '/' + LANGUAGE + '/json/help?id=' + $scope.id
            })
            .success(function(data) {
                $scope.help = data
            })
    }])



// MESSAGES
    .controller('messagesCtrl', ['$scope', '$http', function($scope, $http) {
        $scope.id = PATH[3]
        var id_param = $scope.id ? '?new_id=' + $scope.id : ''

        $http({
                method : 'GET',
                url    : '/' + LANGUAGE + '/json/messages' + id_param
            })
            .success(function(data) {
                $scope.conversations = data
            })

        $scope.openConversation = function(id) {
            $scope.id = id
            $scope.selected = parseInt(id)
            $scope.loading = true

            $http({
                    method : 'GET',
                    url    : '/' + LANGUAGE + '/json/messages/' + id
                })
                .success(function(data) {
                    $scope.messages = data
                    $scope.loading = false
                })
        }

        $scope.sendMessage = function() {
            $scope.sending = true
            $http({
                    method : 'POST',
                    url    : '/' + LANGUAGE + '/json/messages/' + $scope.id,
                    data   : { 'message': $scope.message }
                })
                .success(function(data) {
                    var day_in_list = false
                    for(i in $scope.messages.days) {
                        if($scope.messages.days[i].relative_date === data.day.relative_date) {
                            day_in_list = true
                            break
                        }
                    }
                    for(i in $scope.conversations) {
                        if($scope.conversations[i].id === $scope.id) {
                            $scope.conversations[i].relative_date = data.message.relative_date
                            $scope.conversations[i].ordinal = data.message.message_id
                            break
                        }
                    }
                    if(!day_in_list) $scope.messages.days.push(data.day)

                    $scope.messages.messages.push(data.message)
                    $scope.message = ''
                    $scope.sending = false
                })
                .error(function(data) {
                    console.log(data)
                    $scope.sending = false
                })
        }

        if($scope.id) $scope.openConversation($scope.id)
    }])
