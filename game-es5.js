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
wrapGenerator.mark(ask_about_lifestyle);
var game, auto_add, info = {};

var auth = new FirebaseSimpleLogin(F, function(error, user) {
	if (user){
	  firebase_user_id = user.uid;
	  facebook_id = user.id;
	  $('#login').hide();
	}
});

function ask_about_lifestyle(lifestyle) {
 return wrapGenerator(function ask_about_lifestyle$($ctx0) {
  while (1) switch ($ctx0.next) {
  case 0:
   if (!(!lifestyle.has_lived || !lifestyle.has_lived[firebase_user_id])) {
    $ctx0.next = 6;
    break;
   }

   ask("How long did you live as a "+lifestyle.name+"?", 'lifestyle_timeframes');
   $ctx0.next = 4;
   return null;
  case 4:
   $ctx0.t0 = $ctx0.sent;
   User.lived_lifestyle(lifestyle, $ctx0.t0);
  case 6:
  case "end":
   return $ctx0.stop();
  }
 }, this);
}

function new_activity(name, time_desire, container, options){
	if (!options) options = {};
	options.name = name;
	options.desires = [time_desire];
	options[container.collection] = [container.id];
	return F.child('activities').push(options).name();
}

function ensure_activity_in_container(activity, container){
	var current_set = activity[container.collection] || [];
	if (current_set.indexOf(container.id) < 0){
		current_set.push(container.id);
		var update_spec = {};
		update_spec[container.collection] = current_set;
		F.child('activities').child(activity.id).update(update_spec);
	}
}

function play() {
 var container, activity, activity_time_desire, activity_duration, would_do, other_container, better_activity, worse_activity, same_container, better_activity_lifestyle, better_activity_city, better_activity_identity;

 return wrapGenerator(function play$($ctx1) {
  while (1) switch ($ctx1.next) {
  case 0:
   if (!1) {
    $ctx1.next = 96;
    break;
   }

   info = {};

   // 1. pick or add a lifestyle

   ask("Pick a lifestyle you've lived, a city you've lived in, or a thing you want to be:", ['lifestyles', 'cities', 'identities'], {auto_add: true});

   $ctx1.next = 5;
   return null;
  case 5:
   container = info.container = $ctx1.sent;

   if (!(container.collection == 'lifestyles')) {
    $ctx1.next = 8;
    break;
   }

   return $ctx1.delegateYield(ask_about_lifestyle(container), "t1", 8);
  case 8:
   // 2. pick or add an activity

   if (container.collection == 'lifestyles'){
    Fireball.set('$lifestyle', container.id);
    ask("Choose an activity that %ns do:", ['activities_by_lifestyle', 'all_activities']);
   } else if (container.collection == 'identities'){
    Fireball.set('$identity', container.id);
    ask("Choose an activity that people who are trying to be %n do:", ['activities_by_identity', 'all_activities']);
   } else if (container.collection == 'cities'){
    Fireball.set('$city', container.id);
    ask("Choose an activity that people who live in %n do:", ['activities_by_city', 'all_activities']);
   }

   $ctx1.next = 11;
   return null;
  case 11:
   activity = info.activity = $ctx1.sent;

   // add container if they choose one of the noncontainer set
   ensure_activity_in_container(activity, container);

   ask("When people do %a, what are they looking for?", 'time_desires');
   $ctx1.next = 16;
   return null;
  case 16:
   activity_time_desire = info.desire = $ctx1.sent;
   Fireball.set('$desire', activity_time_desire);

   if (!activity.is_new) {
    $ctx1.next = 26;
    break;
   }

   ask('How long does %a usually take?', 'activity_durations');
   $ctx1.next = 22;
   return null;
  case 22:
   activity_duration = $ctx1.sent;
   activity.id = new_activity(activity.name, activity_time_desire, container, { takes: activity_duration });
   $ctx1.next = 27;
   break;
  case 26:
   if (activity.desires.indexOf(activity_time_desire) < 0){
				activity.desires.push(activity_time_desire);
				F.child('activities').child(activity.id).update({
					desires: activity.desires
				});
			}
  case 27:
   ask("Would you do %a next week, if you could?", 'yes_or_no');
   $ctx1.next = 30;
   return null;
  case 30:
   would_do = $ctx1.sent;

   User.would_do(activity.id, would_do)



   // 3. get some add'l info about the activity;

   if (!(container.collection != 'lifestyles')) {
    $ctx1.next = 38;
    break;
   }

   ask("Is there a name for the kind of person who does %a?", 'lifestyles', { escape_hatch: true, auto_add: true });
   $ctx1.next = 36;
   return null;
  case 36:
   other_container = $ctx1.sent;
   if (other_container) ensure_activity_in_container(activity, other_container);
  case 38:
   if (!(container.collection != 'cities')) {
    $ctx1.next = 44;
    break;
   }

   ask("Is there a city where many people do %a?", 'cities', { escape_hatch: true, auto_add: true });
   $ctx1.next = 42;
   return null;
  case 42:
   other_container = $ctx1.sent;
   if (other_container) ensure_activity_in_container(activity, other_container);
  case 44:
   if (!(container.collection != 'identities')) {
    $ctx1.next = 50;
    break;
   }

   ask("What are people trying to be when they do %a?", 'identities', { escape_hatch: true, auto_add: true });
   $ctx1.next = 48;
   return null;
  case 48:
   other_container = $ctx1.sent;
   if (other_container) ensure_activity_in_container(activity, other_container);
  case 50:
   // 4. relate that activity to other activities

   ask("For %d, pick an activity you like better than %a:", 'activities_by_desire');

   $ctx1.next = 53;
   return null;
  case 53:
   better_activity = $ctx1.sent;

   if (container.collection == 'lifestyles'){
    ask("Choose an activity you don't like as much as %a, but that %ns do for %d:", ['activities_by_lifestyle', 'all_activities'], { escape_hatch: true});
   } else if (container.collection == 'cities'){
    ask("Choose an activity you don't like as much as %a, but that people in %n do for %d:", ['activities_by_city', 'all_activities'], { escape_hatch: true});
   } else if (container.collection == 'identities'){			
    ask("Choose an activity you don't like as much as %a, but that people who want to be %n do for %d:", ['activities_by_identity', 'all_activities'], { escape_hatch: true});
   }

   $ctx1.next = 57;
   return null;
  case 57:
   worse_activity = $ctx1.sent;

   if (worse_activity && worse_activity.is_new){
    worse_activity.id = new_activity(worse_activity.name, activity_time_desire, container);
   } else if (worse_activity) {
    ensure_activity_in_container(worse_activity, container);
   }

   if (!better_activity.is_new) {
    $ctx1.next = 90;
    break;
   }

   if (container.collection == 'lifestyles'){
				ask('Is '  +better_activity.name+ ' also something that %ns do?', 'yes_or_no');
			} else if (container.collection == 'cities'){
				ask('Is '  +better_activity.name+ ' also something that people in %n do?', 'yes_or_no');
			} else {
				ask('Is '  +better_activity.name+ ' also something that people who want to be %n do?', 'yes_or_no');
			}

   $ctx1.next = 63;
   return null;
  case 63:
   same_container = $ctx1.sent;

   if (!(same_container == 'Yes')) {
    $ctx1.next = 68;
    break;
   }

   better_activity.id = new_activity(better_activity.name, activity_time_desire, container);
   $ctx1.next = 90;
   break;
  case 68:
   if (!(container.collection == 'lifestyles')) {
    $ctx1.next = 76;
    break;
   }

   ask("What lifestyle does " + better_activity.name  +"?", 'lifestyles', { auto_add: true });
   $ctx1.next = 72;
   return null;
  case 72:
   better_activity_lifestyle = $ctx1.sent;
   better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_lifestyle);
   $ctx1.next = 90;
   break;
  case 76:
   if (!(container.collection == 'cities')) {
    $ctx1.next = 84;
    break;
   }

   ask("What city do people do " + better_activity.name  +" in?", 'cities', { auto_add: true });
   $ctx1.next = 80;
   return null;
  case 80:
   better_activity_city = $ctx1.sent;
   better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_city);
   $ctx1.next = 90;
   break;
  case 84:
   if (!(container.collection == 'identities')) {
    $ctx1.next = 90;
    break;
   }

   ask("When people do " + better_activity.name  +" what are they trying to be?", 'identities', { auto_add: true });
   $ctx1.next = 88;
   return null;
  case 88:
   better_activity_identity = $ctx1.sent;
   better_activity.id = new_activity(better_activity.name, activity_time_desire, better_activity_identity);
  case 90:
   if (better_activity.id){
    User.thinks_x_is_better_than_y(better_activity, activity);
    if (worse_activity) User.thinks_x_is_better_than_y(activity, worse_activity);			
   }

   // AND play again

   ask("thank you! play again?", 'yes_or_no');

   $ctx1.next = 94;
   return null;
  case 94:
   $ctx1.next = 0;
   break;
  case 96:
  case "end":
   return $ctx1.stop();
  }
 }, this);
}

Fireball(F, {
	init: function(){
		game = play();
		game.next();
	},

	map: {
		"#lifestyles_list...": 'lifestyles',
		"#identities_list...": 'identities',
		"#cities_list...":     'cities',
		"#activities_by_lifestyle_list...": 'activities_by_lifestyle/$lifestyle',
		"#activities_by_identity_list...": 'activities_by_identity/$identity',
		"#activities_by_city_list...": 'activities_by_city/$city',
		"#activities_by_desire_list...": 'activities_by_desire/$desire',
		"#all_activities_list...": 'activities'
	},

	calculated_fields: {
		"#lifestyles_list how_many_lives": function(lifestyle){
			if (!lifestyle.has_lived) return "";
			if (lifestyle.has_lived[firebase_user_id]) return "You have lived this";
			else return Object.keys(lifestyle.has_lived).length + " have lived this";
		}
	},

	on_click: {
		'#answers div a': function(a){
			if (a.id == 'escape_hatch') return null;
			var data = a.parentNode.data;
			if (!data) return game.next(a.innerText);
			data.is_new = false;
			data.id = a.parentNode.id;
			data.collection = a.parentNode.parentNode.parentNode.id;
			game.next(data);
		},
		'#login': function(a){
			auth.login('facebook', { rememberMe: true });
		}
	},

	on_submit: {
		'form': function(f){
			var v = f.elements[0].value;
			f.elements[0].value = '';
			var data = { name: v, is_new: true, collection: f.parentNode.id };
			if (auto_add){
				if (data.collection == 'lifestyles'){
					data.id = F.child('lifestyles').push({ name: data.name }).name();
				}
				if (data.collection == 'identities'){
					data.id = F.child('identities').push({ name: data.name }).name();
				}
				if (data.collection == 'cities'){
					data.id = F.child('cities').push({ name: data.name }).name();
				}
			}
			game.next(data);
		}
	}
});
