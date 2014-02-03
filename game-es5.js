(function(
  // Reliable reference to the global object (i.e. window in browsers).
  global,

  // Dummy constructor that we use as the .constructor property for
  // functions that return Generator objects.
  GeneratorFunction
) {
  var hasOwn = Object.prototype.hasOwnProperty;

  if (global.wrapGenerator) {
    return;
  }

  function wrapGenerator(innerFn, self) {
    return new Generator(innerFn, self || null);
  }

  global.wrapGenerator = wrapGenerator;
  if (typeof exports !== "undefined") {
    exports.wrapGenerator = wrapGenerator;
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  wrapGenerator.mark = function(genFun) {
    genFun.constructor = GeneratorFunction;
    return genFun;
  };

  // Ensure isGeneratorFunction works when Function#name not supported.
  if (GeneratorFunction.name !== "GeneratorFunction") {
    GeneratorFunction.name = "GeneratorFunction";
  }

  wrapGenerator.isGeneratorFunction = function(genFun) {
    var ctor = genFun && genFun.constructor;
    return ctor ? GeneratorFunction.name === ctor.name : false;
  };

  function Generator(innerFn, self) {
    var generator = this;
    var context = new Context();
    var state = GenStateSuspendedStart;

    function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        throw new Error("Generator has already finished");
      }

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          try {
            var info = delegate.generator[method](arg);

            // Delegate generator ran and handled its own exceptions so
            // regardless of what the method was, we continue as if it is
            // "next" with an undefined arg.
            method = "next";
            arg = void 0;

          } catch (uncaught) {
            context.delegate = null;

            // Like returning generator.throw(uncaught), but without the
            // overhead of an extra function call.
            method = "throw";
            arg = uncaught;

            continue;
          }

          if (info.done) {
            context[delegate.resultName] = info.value;
            context.next = delegate.nextLoc;
          } else {
            state = GenStateSuspendedYield;
            return info;
          }

          context.delegate = null;
        }

        if (method === "next") {
          if (state === GenStateSuspendedStart &&
              typeof arg !== "undefined") {
            // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
            throw new TypeError(
              "attempt to send " + JSON.stringify(arg) + " to newborn generator"
            );
          }

          if (state === GenStateSuspendedYield) {
            context.sent = arg;
          } else {
            delete context.sent;
          }

        } else if (method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw arg;
          }

          context.dispatchException(arg);
        }

        state = GenStateExecuting;

        try {
          var value = innerFn.call(self, context);

          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          var info = {
            value: value,
            done: context.done
          };

          if (value === ContinueSentinel) {
            if (context.delegate && method === "next") {
              // Deliberately forget the last sent value so that we don't
              // accidentally pass it on to the delegate.
              arg = void 0;
            }
          } else {
            return info;
          }

        } catch (thrown) {
          if (method === "next") {
            context.dispatchException(thrown);
          } else {
            arg = thrown;
          }
        }
      }
    }

    generator.next = invoke.bind(generator, "next");
    generator.throw = invoke.bind(generator, "throw");
  }

  Generator.prototype.toString = function() {
    return "[object Generator]";
  };

  function Context() {
    this.reset();
  }

  Context.prototype = {
    constructor: Context,

    reset: function() {
      this.next = 0;
      this.sent = void 0;
      this.tryStack = [];
      this.done = false;
      this.delegate = null;

      // Pre-initialize at least 20 temporary variables to enable hidden
      // class optimizations for simple generators.
      for (var tempIndex = 0, tempName;
           hasOwn.call(this, tempName = "t" + tempIndex) || tempIndex < 20;
           ++tempIndex) {
        this[tempName] = null;
      }
    },

    stop: function() {
      this.done = true;

      if (hasOwn.call(this, "thrown")) {
        var thrown = this.thrown;
        delete this.thrown;
        throw thrown;
      }

      return this.rval;
    },

    keys: function(object) {
      return Object.keys(object).reverse();
    },

    pushTry: function(catchLoc, finallyLoc, finallyTempVar) {
      if (finallyLoc) {
        this.tryStack.push({
          finallyLoc: finallyLoc,
          finallyTempVar: finallyTempVar
        });
      }

      if (catchLoc) {
        this.tryStack.push({
          catchLoc: catchLoc
        });
      }
    },

    popCatch: function(catchLoc) {
      var lastIndex = this.tryStack.length - 1;
      var entry = this.tryStack[lastIndex];

      if (entry && entry.catchLoc === catchLoc) {
        this.tryStack.length = lastIndex;
      }
    },

    popFinally: function(finallyLoc) {
      var lastIndex = this.tryStack.length - 1;
      var entry = this.tryStack[lastIndex];

      if (!entry || !hasOwn.call(entry, "finallyLoc")) {
        entry = this.tryStack[--lastIndex];
      }

      if (entry && entry.finallyLoc === finallyLoc) {
        this.tryStack.length = lastIndex;
      }
    },

    dispatchException: function(exception) {
      var finallyEntries = [];
      var dispatched = false;

      if (this.done) {
        throw exception;
      }

      // Dispatch the exception to the "end" location by default.
      this.thrown = exception;
      this.next = "end";

      for (var i = this.tryStack.length - 1; i >= 0; --i) {
        var entry = this.tryStack[i];
        if (entry.catchLoc) {
          this.next = entry.catchLoc;
          dispatched = true;
          break;
        } else if (entry.finallyLoc) {
          finallyEntries.push(entry);
          dispatched = true;
        }
      }

      while ((entry = finallyEntries.pop())) {
        this[entry.finallyTempVar] = this.next;
        this.next = entry.finallyLoc;
      }
    },

    delegateYield: function(generator, resultName, nextLoc) {
      this.delegate = {
        generator: generator,
        resultName: resultName,
        nextLoc: nextLoc
      };

      return ContinueSentinel;
    }
  };
}).apply(this, Function("return [this, function GeneratorFunction(){}]")());

wrapGenerator.mark(play);
var game, is_new, recent_id, recent_data, auto_add, option_type, fb_id, fb_user_id;
var F = new Firebase('https://lifestyles.firebaseio.com');

var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (user){
	  fb_user_id = user.uid;
	  fb_id = user.id;
	  $('#login').hide();
	}
});

Fireball(F, {
	map: {
		"#lifestyles_list...": 'lifestyles',
		"#activities_by_lifestyle_list...": 'activities_by_lifestyle/$lifestyle',
		"#activities_by_desire_list...": 'activities_by_desire/$desire'
	},

	on_click: {
		'#answers div a': function(a){
			is_new = false;
			recent_id = a.parentNode.id;
			recent_data = a.parentNode.data;
			game.next(a.innerText);
		},
		'#login': function(a){
			auth.login('facebook', { rememberMe: true });
		}
	},

	on_submit: {
		'form': function(f){
			var v = f.elements[0].value;
			f.elements[0].value = '';
			is_new = true;
			recent_id = null;

			if (auto_add && option_type == 'lifestyles'){
				recent_id = F.child('lifestyles').push({name: v}).name();
			}

			game.next(v);
		}
	}
});

function ask(prompt, options, auto_add_setting, escape_hatch){
	auto_add = auto_add_setting;
	option_type = options;
	$('#prompt').html(prompt);
	$('#answers div').hide();
	if (escape_hatch) $('#escape_hatch').show();
	else $('#escape_hatch').hide();
	if (options) $('#'+options).show();
}

function set_user_lived_lifestyle(lifestyle_id, length_of_time){
	F.child('lifestyles').child(lifestyle_id).child('has_lived').child(fb_user_id).set({
		fb_id: fb_id,
		length_of_time: length_of_time
	});
}

function set_user_would(activity_id, yes_or_no){
	var would = (yes_or_no == "Yes" ? 'would' : 'wouldnot');
	console.log('set_user_would', activity_id, yes_or_no, would);
	F.child('activities').child(activity_id).child(would).child(fb_user_id).set({
		fb_id: fb_id
	});
}

function x_is_better_than_y(x, y, x_name, y_name){
	F.child('activities').child(x).child('better_than').child(fb_user_id).set({
		fb_id: fb_id,
		than: y,
		than_name: y_name
	});
	F.child('activities').child(y).child('worse_than').child(fb_user_id).set({
		fb_id: fb_id,
		than: x,
		than_name: x_name
	});
}

function show_fellow_travelers(lifestyle_data){
	if (!lifestyle_data || !lifestyle_data.has_lived) return;
	var keys = Object.keys(lifestyle_data.has_lived);
	var msg = "<p>"+keys.length+" other people lived this: ";
	keys.forEach(function(k){
		msg += " <img src='https://graph.facebook.com/"+lifestyle_data.has_lived[k].fb_id+"/picture'>";
	});

	document.getElementById('tips').innerHTML += msg;
}

function play() {
 var lifestyle, lifestyle_id, lifestyle_timeframe, activity, activity_id, activity_is_new, activity_time_desire, activity_duration, would_do, better_activity, better_activity_id, better_activity_is_new, worse_activity, worse_activity_id, same_lifestyle, better_activity_lifestyle, better_activity_lifestyle_id;

 return wrapGenerator(function play$($ctx0) {
  while (1) switch ($ctx0.next) {
  case 0:
   if (!1) {
    $ctx0.next = 72;
    break;
   }

   ask("Pick a lifestyle you've lived", 'lifestyles', true);
   $ctx0.next = 4;
   return null;
  case 4:
   lifestyle = $ctx0.sent;
   lifestyle_id = recent_id;
   Fireball.set('$lifestyle', lifestyle_id);
   if (recent_data) show_fellow_travelers(recent_data);

   if (!(!recent_data || !recent_data.has_lived || !recent_data.has_lived[fb_user_id])) {
    $ctx0.next = 14;
    break;
   }

   ask("How long did you live as a "+lifestyle+"?", 'lifestyle_timeframes');
   $ctx0.next = 12;
   return null;
  case 12:
   lifestyle_timeframe = $ctx0.sent;
   set_user_lived_lifestyle(lifestyle_id, lifestyle_timeframe);
  case 14:
   ask("Choose an activity that "+lifestyle+"s do:", 'activities_by_lifestyle');
   $ctx0.next = 17;
   return null;
  case 17:
   activity = $ctx0.sent;
   activity_id = recent_id;
   activity_is_new = is_new;
   ask("When people do "+activity+", what are they looking for?", 'time_desires');
   $ctx0.next = 23;
   return null;
  case 23:
   activity_time_desire = $ctx0.sent;
   Fireball.set('$desire', activity_time_desire);

   if (!activity_is_new) {
    $ctx0.next = 33;
    break;
   }

   ask('How long does '+activity+' usually take?', 'activity_durations');
   $ctx0.next = 29;
   return null;
  case 29:
   activity_duration = $ctx0.sent;

   activity_id = F.child('activities').push({
				name: activity,
				lifestyles: [ lifestyle_id ],
				desires: [ activity_time_desire ],
				takes: activity_duration
			}).name();

   $ctx0.next = 33;
   break;
  case 33:
   ask("Would you do "+activity+" next week, if you could?", 'yes_or_no');
   $ctx0.next = 36;
   return null;
  case 36:
   would_do = $ctx0.sent;
   set_user_would(activity_id, would_do);
   ask("For "+activity_time_desire+", pick an activity you like better than "+activity+":", 'activities_by_desire');
   $ctx0.next = 41;
   return null;
  case 41:
   better_activity = $ctx0.sent;
   better_activity_id = recent_id;
   better_activity_is_new = is_new;
   ask("Pick an activity that "+lifestyle+"s do for "+activity_time_desire+" which you don't like as much as "+activity+":", 'activities_by_lifestyle', false, true);
   $ctx0.next = 47;
   return null;
  case 47:
   worse_activity = $ctx0.sent;
   worse_activity_id = recent_id;

   if (worse_activity != "Can't think of one" && is_new){
    worse_activity_id = F.child('activities').push({
     name: worse_activity,
     lifestyles: [ lifestyle_id ],
     desires: [ activity_time_desire ]
    }).name();
   }

   if (!better_activity_is_new) {
    $ctx0.next = 65;
    break;
   }

   ask('Is '  +better_activity+ ' also something that ' + lifestyle + 's do?', 'yes_or_no');
   $ctx0.next = 54;
   return null;
  case 54:
   same_lifestyle = $ctx0.sent;

   if (!(same_lifestyle == 'Yes')) {
    $ctx0.next = 59;
    break;
   }

   better_activity_id = F.child('activities').push({
    name: better_activity,
    lifestyles: [ lifestyle_id ],
    desires: [ activity_time_desire ]
   }).name();

   $ctx0.next = 65;
   break;
  case 59:
   ask("What lifestyle does " + better_activity  +"?", 'lifestyles', true);
   $ctx0.next = 62;
   return null;
  case 62:
   better_activity_lifestyle = $ctx0.sent;
   better_activity_lifestyle_id = recent_id;

   better_activity_id = F.child('activities').push({
    name: better_activity,
    lifestyles: [ better_activity_lifestyle_id ],
    desires: [ activity_time_desire ]
   }).name();
  case 65:
   x_is_better_than_y(better_activity_id, activity_id, better_activity, activity);

   if (worse_activity != "Can't think of one"){
    x_is_better_than_y(activity_id, worse_activity_id, activity, worse_activity);
   }

   ask("thank you! play again?", 'yes_or_no');
   $ctx0.next = 70;
   return null;
  case 70:
   $ctx0.next = 0;
   break;
  case 72:
  case "end":
   return $ctx0.stop();
  }
 }, this);
}

game = play();
game.next();
