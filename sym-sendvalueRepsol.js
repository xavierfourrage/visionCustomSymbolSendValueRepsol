// devolopper/contributor: https://github.com/xavierfourrage

(function (PV) {
	'use strict';
	var definition = {
	    typeName: 'sendvalueRepsol',
		displayName: 'Manual Data Entry Repsol',
	    datasourceBehavior:  PV.Extensibility.Enums.DatasourceBehaviors.Multiple,
		visObjectType: symbolVis,
        iconUrl: 'scripts/app/editor/symbols/ext/icons/data-entry-icon.png',
	    getDefaultConfig: function() {			
	    	return {
	    		DataShape: 'Table',
		        Height: 174,
		        Width: 906,
				defaultTimestamp: '*',
				bgColor: "#239a23",
				ButtonTextColor: "#fff",
				TextColor: "#fff",
				btnWidth: 70,
				btnHeight: 26,
				btnText: "Update",
				showTimestamp: false,
				showAttribute: true,
				showFriendlyAttName: false,
				showCurrentValue: true,
				valColWidth: 100,
				elementColWitdh:200,
				attributeColWidth:201,
				textAlign:"center",	
				textSize: "large",
				cellHeight:35,							
				streamFriendlyNames: []
			};
		},
	    configOptions: function () {
	        return [{
	            title: 'Format Symbol',
	            mode: 'format'
	        }];
	    },
        inject: ['$http', '$q'],
		configure: {
			deleteTrace: configDeleteTrace
			
		}
	};
    
    
	function symbolVis() { }
	PV.deriveVisualizationFromBase(symbolVis);
		
	var baseUrl="https://xf-cs.osisoft.int/piwebapi/";
	
	symbolVis.prototype.init = function (scope, elem, $http, $q){
			
		var TYPES = {
			Single: "Number",
			Double: "Number",
			Float16: "Number", 
			Float32: "Number",
			Float64: "Number",
			Int16: "Number",
			Int32: "Number",
			Int64: "Number",
			String: "String",
			EnumerationValue: "String", //String for now, but should be handled specially
			Boolean: "Boolean",
			DateTime: "String"
			
		};
		scope.runtimeData.streamList = [];
		// scope.isAllSelected = false;
		scope.isBtnEnabled = true;
		scope.config.DataSources = scope.symbol.DataSources;
		scope.records = [];
		
		function buildRecordList(streamlist){			 
			var elementlist=[];
			streamlist.forEach(function(stream){
				elementlist.push(stream.Element)
			})
		 
			var Recordlist=elementlist.filter(function(element,pos){
				return elementlist.indexOf(element)==pos
			})

			var records=[];

			Recordlist.forEach(function(element){
				const elem = []
				streamlist.forEach(function(stream){
					if(stream.Element==element){
						elem.push(stream)
					}					
				})
			records.push(elem)
			})
		return records.reverse();
		}
		

		this.onConfigChange = configChange;
		this.onDataUpdate = dataUpdate;
		
		function configChange(newConfig, oldConfig) {
			
            if (newConfig && oldConfig && !angular.equals(newConfig, oldConfig)) {			
			

			var newdatasoucres = _.difference(newConfig.DataSources, oldConfig.DataSources); //The _.difference() function returns the values of newConfig.DataSources array that are not present in oldConfig.DataSources
			
				if(newdatasoucres.length > 0){
					
					
					getStreams(newdatasoucres).then(function(newstreams){
						var newNames = getFriendlyNameList(newstreams);
						
						if (newConfig.DataSources.length == oldConfig.DataSources.length){
							//	switch in asset context
							scope.runtimeData.streamList = newstreams;
							scope.records = buildRecordList(scope.runtimeData.streamList);
							
						}
						else{
							// drag & drop of a new stream
							scope.runtimeData.streamList = scope.runtimeData.streamList.concat(newstreams);	
							scope.config.streamFriendlyNames = scope.config.streamFriendlyNames.concat(newNames);
							scope.records = buildRecordList(scope.runtimeData.streamList);
						}
						
						
					});					
				}
            }
        }
		
		getStreams(scope.symbol.DataSources).then(function(streams){
			scope.runtimeData.streamList = streams;
			scope.config.streamFriendlyNames =  scope.config.streamFriendlyNames.length > 0 ? scope.config.streamFriendlyNames : getFriendlyNameList(scope.runtimeData.streamList);
			
		});
		
		var units;
		
		function dataUpdate(data){
			if(!data ) return;
			units = data.Rows[0].Label ? _.pluck(data.Rows, 'Units') : units;
			if(!scope.runtimeData.streamList)return;
			scope.runtimeData.streamList.forEach(function(stream, index){
				stream.UOM = units[index];
				stream.CurrentValue = data.Rows[index].Value;
				// stream.Element=data.Rows[index].Path.split('?')[0].split('\\')[data.Rows[index].Path.split('?')[0].split('\\').length-1].split('|')[0]
			})
			scope.records = buildRecordList(scope.runtimeData.streamList);	
			
		}
		
		function getFriendlyNameList(streamlist){
			return _(streamlist).pluck('FriendlyName');
		}
				
		function getStreams(datasources){			
			//Breaking chains: http://stackoverflow.com/questions/28250680/how-do-i-access-previous-promise-results-in-a-then-chain
			var datastreams = _.map(datasources, function(item) {
								var isAttribute = /af:/.test(item);
								var path = isAttribute ? item.replace(/af\:(.*)/,'$1') : item.replace(/pi\:(\\\\.*)\?{1}.*(\\.*)\?{1}.*/,'$1$2');
								var label = isAttribute ? path.split('?')[1].split('|')[1].split('?')[0] : path.match(/\w+$/)[0];
								var friendlyName = isAttribute ? label.split('?')[0].split('|')[label.split('?')[0].split('|').length-1] : label;
								var element=isAttribute? path.split('?')[0].split('\\')[path.split('?')[0].split('\\').length-1] : label
								
							
								return {IsAttribute: isAttribute,
										Path: path, 
										Label: label,
										IsSelected: false, 
										FriendlyName: friendlyName,
										Value: undefined, 
										Timestamp: scope.config.defaultTimestamp,
										Element: element };
							});
			
			var streamsConfigPromise = getStreamsConfig(datastreams);
			
			var enumPromise = streamsConfigPromise.then(function(streamsConfig){
				var deferred = $q.defer();				
				
				var enumBatchRequest = getEnumConfig(streamsConfig.data);	

				_.size(enumBatchRequest) > 0 
						? deferred.resolve($http.post(baseUrl + 'batch', enumBatchRequest, {withCredentials: true}))
						: deferred.resolve('') //if there are no streams of the Enumeration type, resolve emtry string.
										
				return 	deferred.promise;
			});
			
			
			
			return $q.all([streamsConfigPromise, enumPromise]).then(function(responses){
			
				var streamsconfig = responses[0].data;
				var enumerations = responses[1].data;
				
				datastreams.forEach(function(stream, index){					
					stream.IsEnumerationType = isEnumerationType(streamsconfig[index]);
					stream.EnumerationOptions = getEnumerationOptions(enumerations, stream.IsEnumerationType, index);
					stream.Type = getType(streamsconfig[index], stream.IsAttribute);
					stream.ValueUrl = streamsconfig[index].Content.Links.Value;
					stream.isPoint = isPIPoint(streamsconfig[index], stream.IsAttribute);
				});
				
				return datastreams;
			});			
		};
			
		function getStreamsConfig(datastreams){
		
			var batchRequest = {};
			_.each(datastreams, function(datastream, index){
				
				var getDataStreamURL = datastream.IsAttribute ? encodeURI(baseUrl + "attributes?path=" + datastream.Path.split('?')[0]+'|'+datastream.Path.split('?')[1].split('|')[1]) : encodeURI(baseUrl + "points?path=" + datastream.Path);
				
				batchRequest[index] = {
					'Method': 'GET',
					'Resource': getDataStreamURL						
				}
			});
			
			return $http.post(baseUrl + 'batch', JSON.stringify(batchRequest), {withCredentials: true});
		}
		
		function getEnumConfig(streams){
			//TODO: handle digital pi points
			var enumBatchRequest = {};
			_.chain(streams)
				.map(function(stream, index){return {Index: index,
													 Type: stream.Content.Type,
													 EnumUrl: stream.Content.Links.EnumerationSet}})
				.where({Type: "EnumerationValue"})
				.each(function(enumstream){ _.extend(enumBatchRequest,
											getEnumRequest(enumstream.EnumUrl, enumstream.Index),
										    getEnumValuesRequest(enumstream.Index))}) 
				.value();
				
			return enumBatchRequest;
		}
				
		function getEnumRequest(enumUrl, index){
			//using _.object() here to avoid IE compatibility issues
			return _.object(['EnumConfig' + index], [{'Method': 'GET', 'Resource': enumUrl}]);
		}
			
		function getEnumValuesRequest(index){
			//using _.object() here to avoid IE compatibility issues
			return _.object(['EnumValues' + index], [{
									'Method': 'GET',
									'Resource': '{0}',
									'ParentIds': [
										'EnumConfig' + index
									],
									'Parameters': [
										'$.EnumConfig' + index + '.Content.Links.Values'
									]
						}]);	
		}
			
		function isEnumerationType(stream){
			return _.has(stream.Content, "Type") && stream.Content.Type == "EnumerationValue";
		}
		
		function getEnumerationOptions(enumerations, isEnumerationType, index){
			return isEnumerationType ? enumerations["EnumValues" + index].Content.Items : ""; 
			
		}
		
		function getType(stream, isAttribute){
			return isAttribute ? TYPES[stream.Content.Type] : TYPES[stream.Content.PointType];
		}
		
		function isPIPoint(stream, isAttribute){
			return (isAttribute && stream.Content.DataReferencePlugIn == "PI Point") || !isAttribute;
		}
		
	
	   scope.sendValues = function(){
		   
		scope.loading = true; //show button loading icon
		scope.isBtnEnabled = false;   
		   var streams = scope.runtimeData.streamList;
        //    if(!anyStreamsSelected(streams)) return;
               
			var batchRequest = formBulkSendRequest(streams);
			
			//Send batch request to PI Web API endpoint
			var sendDataPromise = _.size(batchRequest) > 0 
									? $http.post(baseUrl + "batch", batchRequest, {withCredentials: true})
									: $q.reject();
									
			sendDataPromise.then(function(){
				setTimeout(function(){
					scope.loading = false;
					scope.isBtnEnabled = true;
					}, 3000);	
				});
			      
			
        
	   };
	   
	   	function formBulkSendRequest_ORIGINAL(streamList) {
			
			var batchRequest = {};
			
			streamList.forEach(function(stream, index){
					if(!stream.IsSelected || (!stream.Value && stream.Value !== 0)) return;			
				
					var data = {
                        "Timestamp": stream.Timestamp,
                        "Value": stream.IsEnumerationType ? stream.Value.Name : stream.Value
					};
					
					var method = stream.isPoint ? "POST" : "PUT";
					
					batchRequest["SendValue" + index] = {
								"Method": method,
								"Resource": stream.ValueUrl,
								"Content": JSON.stringify(data),
								"Headers": {
									'Content-Type': 'application/json'
								}
					}
				
				});		   
			//	console.log(batchRequest);
			return JSON.stringify(batchRequest);
		};

		function formBulkSendRequest(streamList) {
			
			var batchRequest = {};
			
			streamList.forEach(function(stream, index){
					// if(!stream.IsSelected || (!stream.Value && stream.Value !== 0)) return;			
				
					var data = {
                        "Timestamp": stream.Timestamp,
                        "Value": stream.IsEnumerationType ? stream.Value.Name : stream.Value
					};
					
					var method = stream.isPoint ? "POST" : "PUT";
					
					batchRequest["SendValue" + index] = {
								"Method": method,
								"Resource": stream.ValueUrl,
								"Content": JSON.stringify(data),
								"Headers": {
									'Content-Type': 'application/json'
								}
					}
				
				});		   
			//	console.log(batchRequest);
			return JSON.stringify(batchRequest);
		};

		
	   
		scope.toggleAll = function(){			
			var toggleValue = scope.isAllSelected;
			scope.runtimeData.streamList.forEach(function(stream){stream.IsSelected = toggleValue});
			scope.isBtnEnabled  = anyStreamsSelected();
		};
		
		scope.toggleStreamSelection = function(){
			scope.isAllSelected = scope.runtimeData.streamList.every(function(stream){return(stream.IsSelected)});
			scope.isBtnEnabled  = anyStreamsSelected();
			
		};

		scope.toggleStreamSelection2=function(){
		
			scope.isBtnEnabled = !scope.isBtnEnabled;
		}
		
	    function anyStreamsSelected(){
			return scope.runtimeData.streamList.some(function(stream){return(stream.IsSelected)});
		};
		
		


		scope.config.SendBtnStyles = {
			disabled: {
				'cursor': 'not-allowed',
				'opacity':'0.65',
				'background-color': scope.config.bgColor,
				'border': '1px solid rgba(230,231,232,.55)',
				'color': '#fff',
				'width': '80px',
				'height': '26px',
				'text-shadow': '0 -1px 0 rgba(0,0,0,.25)',
				'margin-left': 'auto'
				},
			general: {
				'background-color': scope.config.bgColor,
				'border': '1px solid rgba(230,231,232,.55)',
				'color': '#fff',
				'width': '80px',
				'height': '26px',
				'text-shadow': '0 -1px 0 rgba(0,0,0,.25)',
				'margin-left': 'auto'
				}
			
		}
		
		
		
	}	
	
	
	function configDeleteTrace(scope){
		var index = scope.runtimeData.selectedStream;
        var datasources = scope.symbol.DataSources;
		var streams = scope.runtimeData.streamList;
		
        if (datasources.length > 1) {
            datasources.splice(index, 1);	
			streams.splice(index,1);   
			scope.$root.$broadcast('refreshDataForChangedSymbols');		
		}
		
	};


    PV.symbolCatalog.register(definition);
})(window.PIVisualization);
