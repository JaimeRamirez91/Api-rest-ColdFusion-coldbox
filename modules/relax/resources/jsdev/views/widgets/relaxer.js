/**
* This is the Backbone View For Relaxer
**/
define(
    /**
    * RequireJS Resources loaded in this view.  
    * If not avaialable in the globals file, they will be loaded via HTTP request before the View is instantiated
    **/
    [
    'Backbone',
    'models/RelaxerHistory'
    ],  
    /**
    * Function arguments are the local resource variables for the above
    **/
    function(
            Backbone,
            HistoryModel
        ){
        'use strict';
        var Relaxer = Backbone.View.extend({
            //The jQuery scope for this view
            el:".relaxer"

            /**
            * ----------------------------------------------
            * Event bindings
            * ----------------------------------------------
            */
            //event bindings - restricted to the scope of `this.el` ( DOM selector ) or `this.$el` ( jQuery object )
            ,events:{
                "click .dynamicAdd"             : "onAddDynamicItem",
                "click .dynamicRemove"          : "onRemoveDynamicItem",
                "click .btnSendRequest"         : "onRelaxerSend",
                "click .btnReplayHistoryIndex"  : "onReplayHistoryIndex",
                "click .btnClearHistory"        : "clearHistory"
            }
            /**
            * ----------------------------------------------
            * Initializes this view
            * ----------------------------------------------
            */
            ,initialize:function( options ){

                var _this = this;

                if( _.isUndefined( rootAssetPath ) ){
                    _this.baseHref = '/modules/relax';
                } else {
                    _this.baseHref = rootAssetPath;
                }

                if (_.isUndefined(moduleAPIRoot)) {
                    _this.relaxBaseURL = "/relax";
                } else {
                    _this.relaxBaseURL = moduleAPIRoot;
                }
                
                if( !_.isUndefined( options ) ){
                    _.each( _.keys( options ), function( optionKey ){
                        _this[ optionKey ] = options[ optionKey ];
                    });
                }

                return this.setupDefaults().setupSelectors().render();
            }

            /**
            * ----------------------------------------------
            * Caches the selectors that are used more than once
            * ----------------------------------------------
            */
            ,setupSelectors:function(){

                return this;
            }

            /**
            * ----------------------------------------------
            * Setup some default variables to be used later
            * ----------------------------------------------
            */
            ,setupDefaults:function(){
                var _this = this;


                var storedHistory = localStorage.getItem( 'RelaxerStoredHistory' );

                _this.HistoryModel = new HistoryModel();

                if( storedHistory ){

                    _this.HistoryModel.set( JSON.parse( storedHistory ) );

                }

                _this.relaxerFormTemplate = _.template( $( "#relaxer-form-template" ).html() );
                _this.relaxerResponseTemplate = _.template( $( "#relaxer-response-template" ).html() );

                return this;
            }

            /**
			* ----------------------------------------------
			* Renders UI
			* ----------------------------------------------
			*/
            ,render:function(){
                var _this = this;
                var relaxerFormData = _this.getRelaxerFormData();
                $( ".relaxer-form", _this.el ).html( _this.relaxerFormTemplate( relaxerFormData ) );
                _this.onRelaxerRendered();
                _this.renderHistory();
                return _this.this;
            }

            /**
            * Renders the Relaxer response
            * @param jqXHR          The response jqXHR object
            * @param textStatus     The response text status
            **/
            ,renderRelaxerResponse:function( jqXHR, textStatus ){
                var _this = this;
                var $container = $( ".relaxer-results", _this.$el );

                var responseEcho = JSON.parse( jqXHR.responseText );

                if( typeof( responseEcho.status_code ) === 'undefined' ){

                    var errorMessage = responseEcho.errordetail ? responseEcho.errordetail : responseEcho.error;
                    $container.html('<div class="clearfix"></div>');
                    $container.after( '<p id="relaxer-response-error" class="alert alert-danger">There was an error servicing your request.  The response received was: <em>' +errorMessage+ '</em></p>' )
                    
                } else {

                    //reformat our echo to emulate a jqXHR object
                    var responseObject = {
                        "status": responseEcho.status_code,
                        "statusText": responseEcho.status_text,
                        "responseText": responseEcho.filecontent,
                        getAllResponseHeaders: function(){ 
                            return responseEcho.responseheader;
                        },
                        getResponseHeader: function( headerName ){
                            return responseEcho.responseheader[ headerName ];
                        }
                    }

                    $container.html( _this.relaxerResponseTemplate( {"response":responseObject} ) );
                    _this.renderContainerUI( $container );
   
                }
            }


            /**
            * Data Marshalling
            **/
            ,getRelaxerFormData: function(){
                var _this = this;
                var relaxerData = {
                    
                    "api":_this.APIDocument,
                    
                    "relaxer":{
                        "method":"",
                        "endpoint":"",
                        "extensionDetection":false    
                    }
                }

                return relaxerData;
            }
            
            /**
			* ----------------------------------------------
			* Events
			* ----------------------------------------------
			*/
            ,onRelaxerRendered: function(){
                var _this = this;
                _this.$relaxerForm    = $(".relaxerForm", _this.$el);
                _this.$resultsBox     = $(".relaxerResults", _this.$el);
                _this.$relaxerHeader  = $(".relaxerHeader", _this.$el);

            }

            /**
            * Relax send event
            * @param e      The event object
            **/
            ,onRelaxerSend: function( e ){
                var _this = this;
                var $btn = $( e.currentTarget );

                $( "#relaxer-response-error" ).remove();
                
                //save our html so we can use it when the request is done
                var btnDefaultHTML = $btn.html();
                $btn.find( 'i' ).removeClass( 'fa-paper-plane' ).addClass( 'fa-spin fa-spinner' );
                if( $( ".advancedSettings", _this.$el ).hasClass( "in" ) ) $( ".advancedSettings", _this.$el ).removeClass( "in" );
                //show the loader
                $( ".relaxer-results", _this.$el ).html( _this.loaderMsg );
                
                var _this = this;
                var relaxerRequest = _this.marshallRelaxerRequest();

                var relaxerOptions = {
                    url: _this.relaxBaseURL + "/relaxer/send",
                    method: "POST",
                    data: JSON.stringify( relaxerRequest ),
                    complete: function( jqXHR, textStatus ){
                        $btn.html( btnDefaultHTML );
                        _this.renderRelaxerResponse( jqXHR, textStatus );

                        _this.HistoryModel.attributes.history.push( {
                             "request"  : relaxerRequest,
                             "response" : jqXHR
                         } );

                        localStorage.setItem( 'RelaxerStoredHistory', JSON.stringify( _this.HistoryModel.attributes ) );

                        _this.renderHistory();
                    }
                };
                relaxerOptions.error = relaxerOptions.success;

                $.ajax( relaxerOptions ); 
            }

            /**
            * Action to replay a history item from the saved index
            **/
            ,onReplayHistoryIndex: function( e ){

                var _this = this;
                var $btn = $( e.currentTarget );
                var historyIndex = parseInt( $btn.closest( '.relaxer-history-panel' ).data( 'index' ) );

                var indexData = _this.HistoryModel.attributes.history[ historyIndex ];

                $( '.relaxer-results', _this.el ).empty();

                $( '[name="httpResource"]', _this.$relaxerForm ).val( indexData.request.resource );
                $( '[name="httpMethod"]', _this.$relaxerForm ).val( indexData.request.method );

                //Clear any previous form data
                $( '.httpHeaders', _this.$relaxerForm ).find( '.dynamicField' ).remove();
                $( '.requestParams', _this.$relaxerForm ).find( '.dynamicField' ).remove();
                $( '[name="httpProxy"]', _this.$relaxerForm ).val( '' );
                $( '[name="username"]', _this.$relaxerForm ).val( '' );
                $( '[name="password"]', _this.$relaxerForm ).val( '' );

                _.each( indexData.request.headers, function( headerValue, headerName, headers ){

                    $( '.httpHeaders .btn.dynamicAdd', _this.$relaxerForm ).click();
                    var $dynamicField = $( '.httpHeaders .dynamicField', _this.$relaxerForm  ).last();
                    $( '[name="headerName"]', $dynamicField ).val( headerName );
                    $( '[name="headerValue"]', $dynamicField ).val( headerValue );

                } );

                _.each( indexData.request.data, function( paramValue, paramName, params ){

                    $( '.httpParameters .btn.dynamicAdd', _this.$relaxerForm ).click();
                    var $dynamicField = $( '.httpParameters .dynamicField', _this.$relaxerForm  ).last();
                    $( '[name="parameterName"]', $dynamicField ).val( paramName );
                    $( '[name="parameterValue"]', $dynamicField ).val( paramValue );
                    
                } );

                $( '[name="httpResource"]', _this.$relaxerForm ).focus();

            }

            /**
            * Dynamic object addition event
            * @param e      The event object
            **/
            ,onAddDynamicItem: function( e ){
                return this.addDynamicItem( $(e.currentTarget) )
            }

            /**
            * Dynamic object removal
            * @param e      The event object
            **/
            ,onRemoveDynamicItem: function( e ){
                var $btn = $( e.currentTarget );
                var $field = $btn.closest( '.dynamicField' );
                $field.fadeOut( 300, function(){
                    $field.remove();
                });
            }
            
            /**
            * Marshalls the relaxer response for the view
            **/
            ,marshallRelaxerRequest: function(){
                var _this = this;
                var request = {
                    resource : $( '[name="httpResource"]', _this.$relaxerForm ).val(),
                    method : $( '[name="httpMethod"]', _this.$relaxerForm ).val(),
                    headers : {},
                    data : {}
                }

                if( $( '[name="httpAccept"]', _this.$relaxerForm ).length > 0 ){
                    request.accepts = $( '[name="httpAccept"]', _this.$relaxerForm ).val();
                }

                if( $( '[name="httpProxy"]', _this.$relaxerForm ).val().length > 0 ){
                    request.httpProxy = $( '[name="httpProxy"]', _this.$relaxerForm ).val();
                }

                if( $( '[name="username"]', _this.$relaxerForm ).val().length > 0 ){
                    request.authUsername = $( '[name="username"]', _this.$relaxerForm ).val();
                }

                if( $( '[name="password"]', _this.$relaxerForm ).val().length > 0 ){
                    request.authPassword = $( '[name="password"]', _this.$relaxerForm ).val();
                }
                
                $( ".requestHeaders", _this.$relaxerForm ).find(".dynamicField").each( function(){
                    var $headerContainer = $( this );
                    request.headers[ $headerContainer.find( '[name="headerName"]' ).val() ] = $headerContainer.find( '[name="headerValue"]' ).val();
                });
                
                $( ".requestParams", _this.$relaxerForm ).find(".dynamicField").each( function(){
                    var $paramContainer = $( this );
                    request.data[ $paramContainer.find( '[name="parameterName"]' ).val() ] = $paramContainer.find( '[name="parameterValue"]' ).val();
                });

                return request;
            }

            /**
            * Adds a dynamic item to the headers or params
            * @param $trigger      The button used to fire the addition
            * @param inData        Any data which should populate the dynamic item
            **/
            ,addDynamicItem: function( $trigger, inData){
                var fieldType = $trigger.attr("data-type");
                var fieldsTemplate = _.template( $( "#dynamicFieldsTemplate" ).html() );
                $trigger.before( fieldsTemplate( {
                    "field":_.isUndefined( inData )?{}:inData,
                    "fieldType":fieldType
                } ) );
            }
            
            /**
            * Renders a history item
            **/
            ,renderHistory: function(){
                var _this = this;
                var historyTemplate = _.template( $( "#relaxer-history-template" ).html() );
                var $historyContainer = $( '.relaxer-history', _this.el );
                
                $historyContainer.empty();

                if( _.isUndefined( _this.HistoryModel.attributes.history ) ) return;

                if( _this.HistoryModel.attributes.history.length > 0 ){
                    try{
                        $historyContainer.html( 
                            historyTemplate( {
                               "history"            : _this.HistoryModel.attributes.history,
                               "responseTemplate"   : _.template( $( "#relaxer-response-template" ).html() )
                            } )
                        );
                        _this.renderContainerUI( $historyContainer );   
                    } catch( err ){
                        localStorage.removeItem( 'RelaxerStoredHistory' );
                        $historyContainer.append( '<p class="alert alert-danger">Oops! There was an error in rendering your relaxer history.  We may have received some bad information from a recent request that could not be parsed. As a result, we have had to clear your history data in order to continue.</p>' );
                    }
                }
            }

            /**
            * Clears the relaxer history
            **/
            ,clearHistory: function( e ){
                var _this = this;
                var $btn = $( e.currentTarget );

                var $historyContainer = $( '.relaxer-history', _this.el );

                $historyContainer.fadeOut( 600, function(){

                    _this.HistoryModel.attributes.history = [];

                    localStorage.removeItem( 'RelaxerStoredHistory' );
                    
                    _this.renderHistory();
                    
                    $historyContainer.show();

                });
            }

            /**
            * Renders the default container UI
            * @param $container      The target container
            **/
            ,renderContainerUI: function( $container ){
                var _this = this;
                $( '[data-toggle="tooltip"]', $container ).each( function(){
                    $( this ).tooltip();
                });
                $( 'pre[class*="language-"],code[class*="language-"]' ).each( function(){
                    Prism.highlightElement(this); 
                });
            }
            
            //Miscellaneous Templates
            ,loaderMsg:'\
                <div id="bottomCenteredLoader">\
                    <p class="text-center">\
                        Sending Request... <br/>\
                        <i class="fa fa-spinner fa-spin fa-3x"></i>\
                    </p>\
                </div>'

        });

        return Relaxer;
    }
);		