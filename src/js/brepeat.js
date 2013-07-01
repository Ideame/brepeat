/* =========================================================
 * brepeat.js
 * https://github.com/Ideame/brepeat
 * =========================================================
 * Copyright 2013 Ideame Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * ========================================================= */

!function($) {

    var Brepeat = function(element, options) {
        this.element = $(element);
        this._options = options;

        this._lang = i18n[options.lang];
        this._summaryDisplay = $(options.summaryDisplay || this.element.data().summaryDisplay);
        this._parentDtp = $(options.datetimepicker || this.element.data().datetimepicker);
        this._parentDp = $(options.datepicker || this.element.data().datepicker);
        if (this._summaryDisplay.length === 0) this._summaryDisplay = null;
        if (this._parentDtp.length === 0) this._parentDtp = null;
        if (this._parentDp.length === 0) this._parentDp = null;

        var pickerType;
        if ($.fn.datetimepicker && !this._parentDp) {
            pickerType = 'datetimepicker';
        } else if ($.fn.datepicker && !this._parentDtp) {
            pickerType = 'datepicker';
        }
        this.popup = $(renderPopup(this._lang, options.maxRepeatTimes, options.maxOccurrences, pickerType)).appendTo('body');

        if (pickerType === 'datetimepicker') {
            this.popup.find('#brepeat-starton').datetimepicker();
            this._startsOnDtp = this.popup.find('#brepeat-starton').data().datetimepicker;
            this._startsOnDtp.disable();

            this.popup.find('#brepeat-endson-on-date').datetimepicker({
                pickTime: false
            });
            this._endsOnDtp = this.popup.find('#brepeat-endson-on-date').data().datetimepicker;
            this._endsOnDtp.disable();

        } else if (pickerType === 'datepicker') {
            this.popup.find('#brepeat-starton').datepicker();
            this._startsOnDp = this.popup.find('#brepeat-starton').data().datepicker; //TODO: check this
        } else {
            throw new Error('Bootstrap datepicker or datetimepicker plugin is required.');
        }

        var _this = this;
        var parentPicker = this._parentDtp || this._parentDp;
        if (parentPicker) {
            parentPicker.on({
                changeDate: function(e) {
                    if (pickerType === 'datetimepicker') {
                        _this.startsOn(_this._parentDtp.data().datetimepicker.getDate());
                    }
                } //TODO: check if datepicker dispatch this event
            });
        }

        if (_this._summaryDisplay) {
            _this._summaryDisplay.find('a.brepeat-edit').live('click', $.proxy(this.show, this));
        }

        this.element.on({
            change: function(e) {
                if($(this).is(':checked')) {
                    if (_this._summaryDisplay) {
                        _this._summaryDisplay.removeClass('disabled');
                        if (_this._summaryDisplay.html() === '') _this.show(e);
                    } else {
                        _this.show(e);
                    }
                } else if (_this._summaryDisplay) _this._summaryDisplay.addClass('disabled');

            }
        });

        this.popup.find('#brepeat-frequency').on({
            change: $.proxy(uiChanged, this, 'frequency')
        });

        this.popup.find('#brepeat-interval').on({
            change: $.proxy(uiChanged, this, 'interval')
        });

        this.popup.find('#brepeat-on input[type="checkbox"]').on({
            change: $.proxy(uiChanged, this, 'interval')
        });

        this.popup.find('#brepeat-endson-after-input').on({
            keyup: $.proxy(uiChanged, this, 'interval')
        });

        this.popup.find('input[name="repeatby"]').on({
            change: $.proxy(uiChanged, this, 'ends')
        });

        this.popup.find('input[name="endson"]').on({
            change: $.proxy(uiChanged, this, 'ends')
        });

        if (this._endsOnDtp) {
            this.popup.find('#brepeat-endson-on-date').on({
                changeDate: $.proxy(uiChanged, this, 'ends')
            });
        }

        this.popup.find('.modal-footer .btn.cancel').on({
            click: function(e) {
                _this.restore();
                _this.hide();
            }
        });

        this.popup.find('.modal-footer .btn.done').on({
            click: function(e) {
                if (_this._callback) {
                    _this._callback(_this.val());
                }
                if (_this._summaryDisplay) {
                    _this._summaryDisplay.html(_this.summary() + '. <a class="brepeat-edit" href="javascript:void(0);">' + _this._lang.edit + '</a>');
                }
                _this.hide();
            }
        });

        this.reset();
    };

    Brepeat.prototype = {
        lang: function(value) {
            if (!value) {
                return this._lang;
            }
            this._lang = i18n[value];
        },

        show: function(e) {
            if (e) {
                if ($.type(e) === 'function') { //callback
                    this._callback = e;
                } else {
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
            this._initialValues = this.val();
            this.popup.modal('show');
        },

        hide: function(){
            this._callback = undefined;
            this.popup.modal('hide');
        },

        restore: function() {
            if (!this._initialValues) {
                this.reset();
                return;
            }

            this.frequency(this._initialValues.frequency);

            this.interval('every', this._initialValues.every);

            if (this._initialValues.on) {
                this.interval('on', this._initialValues.on.join(','));
            }

            if (this._initialValues.by) {
                this.interval('by', this._initialValues.by.type);
            }

            switch (this._initialValues.ends.type) {
                case 'never':
                    this.ends('never');
                    break;
                case 'after':
                    this.ends('after', this._initialValues.ends.occurrences);
                    break;
                case 'on':
                    this.ends('on', this._initialValues.ends.date);
                    break;
            }
        },

        reset: function() {
            var arr, type, value;

            value = this.element.data().frequency;
            if (value) this.frequency(value);

            arr = type = value = undefined;
            arr = (this.element.data().interval || '').split(',');
            if (arr.length > 0) type = arr.shift();
            if (type === 'every&on') {
                this.interval('every', arr.shift());
                type = 'on';
            }
            if (arr.length > 0) value = arr.join(',');
            if (type && value) this.interval(type, value);

            arr = type = value = undefined;
            arr = (this.element.data().ends || '').split(',');
            if (arr.length > 0) type = arr.shift();
            if (arr.length > 0) value = arr.join(',');
            if (type) this.ends(type, value);

            arr = type = value = undefined;
            value = this.element.data().startsOn;
            if (value) {
                this.startsOn(value);
            } else {
                if (this._parentDtp) {
                    this.startsOn(this._parentDtp.data().datetimepicker.getDate());
                } else if (this._parentDp) {
                    this.startsOn(this._parentDp.val()); //TODO: check this
                }
            }

            this.summary(true);
        },

        val: function() {
            var r = this.interval();
            r.ends = this.ends();
            r.startsOn = this.startsOn();
            return r;
        },

        summary: function(updateUI) {
            var summary = '';
            var val = this.val();
            var freqTexts = {
                daily: { name: this._lang.frequencyValues[0], unit: this._lang.days },
                weekly: { name: this._lang.frequencyValues[1], unit: this._lang.weeks },
                monthly: { name: this._lang.frequencyValues[2], unit: this._lang.months },
                yearly: { name: this._lang.annually, unit: this._lang.years }
            };

            if (val.every > 1) {
                summary = this._lang.every + ' ' + val.every + ' ' + freqTexts[val.frequency].unit;
            } else {
                summary = freqTexts[val.frequency].name;
            }

            if (val.by) {
                summary += ' ' + this._lang.on.toLowerCase() + ' ';
                if (val.by.type === 'dm') {
                    summary += this._lang.day + ' ' + val.by.day;
                } else if (val.by.type === 'dw') {
                    summary += this._lang.the + ' ' + this._lang[val.by.ordinal] + ' ' + this._lang.dates.days[val.by.day].name;
                }
            } else if (val.on && val.on.length > 0) {
                summary += ' ' + this._lang.on.toLowerCase() + ' ';

                var intersection = function(a1, a2) {
                    return $.map(a1, function(o){ return $.inArray(o, a2) < 0 ? null : o; });
                };

                if (val.on.length == 2 && intersection(['su','sa'], val.on).length == 2) {
                    summary += this._lang.weekend;
                } else if (val.on.length == 5 && intersection(['mo','tu','we','th','fr'], val.on).length == 5) {
                    summary += this._lang.weekdays;
                } else {
                    var days = this._lang.dates.days;
                    summary += days[val.on.shift()].name;

                    $.each(val.on, function(i, d) {
                        summary += ', ' + days[d].name;
                    });
                }
            }

            if (val.ends.type === 'after') {
                summary += ', ' + val.ends.ocurrences + ' ' + this._lang.times;
            } else if (val.ends.type === 'on') {
                summary += ', ' + this._lang.until + ' ' + this._lang.dates.monthsShort[val.ends.date.getMonth()] + ' ' + val.ends.date.getDate() + ', ' + val.ends.date.getFullYear();
            }

            if (updateUI) {
                this.popup.find('#brepeat-summary td').html('<strong>' + summary + '</strong>');
            }
            return summary;
        },

        frequency: function(value) {
            // get
            if (!value) {
                return this.popup.find('#brepeat-frequency').val();
            }

            // set
            if (!/daily|weekly|monthly|yearly/i.test(value))
                throw new Error('Invalid value for frequency type. Expected values: daily, weekly, monthly, yearly.');

            value = value.toLowerCase();
            this.popup.find('#brepeat-frequency').val(value);

            switch (value) {
                case 'daily':
                    this.popup.find('#brepeat-on').parents('tr').hide();
                    this.popup.find('#brepeat-by-dm').parents('tr').hide();
                    this.popup.find('#brepeat-interval').next().html(this._lang.days);
                    break;
                case 'weekly':
                    this.popup.find('#brepeat-on').parents('tr').show();
                    this.popup.find('#brepeat-by-dm').parents('tr').hide();
                    this.popup.find('#brepeat-interval').next().html(this._lang.weeks);
                    break;
                case 'monthly':
                    this.popup.find('#brepeat-on').parents('tr').hide();
                    this.popup.find('#brepeat-by-dm').parents('tr').show();
                    this.popup.find('#brepeat-interval').next().html(this._lang.months);
                    break;
                case 'yearly':
                    this.popup.find('#brepeat-by-dm').parents('tr').hide();
                    this.popup.find('#brepeat-on').parents('tr').hide();
                    this.popup.find('#brepeat-interval').next().html(this._lang.years);
                    break;
            }

            this.summary(true);
        },

        interval: function(type, value) {
            // get
            if (!type) {
                var r = {
                    frequency: this.frequency()
                };

                switch (r.frequency) {
                    case 'daily':
                    case 'yearly':
                        r.every = parseInt(this.popup.find('#brepeat-interval').val(), 10);
                        break;

                    case 'weekly':
                        r.every = parseInt(this.popup.find('#brepeat-interval').val(), 10);
                        r.on = [];
                        $.each(this.popup.find('#brepeat-on input[type=checkbox]:checked'), function(i, el) {
                            r.on.push($(el).attr('name'));
                        });
                        break;

                    case 'monthly':
                        var date;
                        if (this._startsOnDtp) {
                            date = this._startsOnDtp.getDate();
                        } else if (this._startsOnDp) {
                            //TODO: date =
                        }

                        r.every = parseInt(this.popup.find('#brepeat-interval').val(), 10);
                        r.by = {
                            type: this.popup.find('input[name=repeatby]:checked').val(),
                            day: null
                        };
                        if (r.by.type === 'dm') {
                            r.by.day = date.getDate();
                        } else if (r.by.type === 'dw') {
                            var ordinals = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'last' };
                            r.by.ordinal = ordinals[Math.ceil(date.getDate()/7)];
                            r.by.day = $.map(this._lang.dates.days, function(v,k){return k;})[date.getDay()];
                        }
                        break;
                }

                return r;
            }

            // set
            switch (type.toLowerCase()) {
                case 'every':
                    value = parseInt(value, 10);
                    if (isNaN(value) || value <= 0 || value > this._options.maxRepeatTimes)
                        throw new Error('Invalid value for interval repeat every. Expected values: 0 > n <= ' + this._options.maxRepeatTimes);

                    this.popup.find('#brepeat-interval').val(value);

                    break;

                case 'on':
                    if (!value) throw new Error('Invalid value for interval type. Expected values: mo,tu,we,th,fr,sa,su.');
                    if (typeof value === 'string') value = value.split(',');

                    //clen checkboxes
                    this.popup.find('#brepeat-on input[type="checkbox"]').attr('checked', false);

                    for (var i=0; i<value.length; i++) {
                        if (!/mo|tu|we|th|fr|sa|su/i.test(value[i]))
                            throw new Error('Invalid value "' + value[i] + '" for interval type. Expected values: mo,tu,we,th,fr,sa,su.');

                        this.popup.find('#brepeat-on input[name="' + $.trim(value[i]).substr(0,2).toLowerCase() + '"]').attr('checked', true);
                    }
                    break;

                case 'by':
                    if (!/dm|dw/i.test(value))
                        throw new Error('Invalid value for interval type. Expected values: dm, dw.');

                    this.popup.find('#brepeat-by-' + value.toLowerCase()).attr('checked', true);
                    break;

                default:
                    throw new Error('Invalid interval type. Expected values: every, on, by.');

            }

            this.summary(true);
        },

        startsOn: function(value) {
            if (!value) {
                if (this._startsOnDp) return this._startsOnDp.val(); //TODO: getValue?? check this
                if (this._startsOnDtp) return this._startsOnDtp.getDate();

                return null;
            }

            if (this._startsOnDp) {
                this._startsOnDp('setValue', value);
            } else if (this._startsOnDtp) {
                this._startsOnDtp.setDate(value);
            }
        },

        ends: function(type, value) {
            // get
            if (!type) {
                var r = { type: this.popup.find('input[name=endson]:checked').val() };
                switch (r.type) {
                    case 'after':
                        r.ocurrences = this.popup.find('#brepeat-endson-after-input').val();
                        break;

                    case 'on':
                        r.date = null;
                        if (this._endsOnDtp) {
                            r.date = this._endsOnDtp.getDate();
                        } else if (this._endsOnDp) {
                            r.date = null; //TODO: datepicker value;
                        }
                        break;
                }

                return r;
            }

            if (!/never|after|on/i.test(type))
                throw new Error('Invalid type for ends. Expected values: never, after, on.');

            switch (type.toLowerCase()) {
                case 'never':
                    this.popup.find('#brepeat-endson-never').attr('checked', true);
                    this.popup.find('#brepeat-endson-after-input').attr('disabled', '');
                    if (this._endsOnDtp) this._endsOnDtp.disable();
                    break;

                case 'after':
                    value = parseInt(value, 10);
                    if (isNaN(value) || value <= 0 || value > this._options.maxOccurrences)
                        throw new Error('Invalid value for ends after. Expected values: 0 > n <= ' + this._options.maxOccurrences);

                    this.popup.find('#brepeat-endson-after').attr('checked', true);
                    this.popup.find('#brepeat-endson-after-input').val(value);
                    this.popup.find('#brepeat-endson-after-input').removeAttr('disabled');
                    if (this._endsOnDtp) this._endsOnDtp.disable();
                    break;

                case 'on':
                    this.popup.find('#brepeat-endson-on').attr('checked', true);
                    var date = value;
                    if ($.type(value) != 'date') date = new Date(value);

                    if (this._endsOnDtp) {
                        this._endsOnDtp.enable();
                        if (value) this._endsOnDtp.setDate(date);
                    }
                    this.popup.find('#brepeat-endson-after-input').attr('disabled', '');
                    break;
            }

            this.summary(true);
        }
    };

    $.fn.brepeat = function (options, val) {
        return this.each(function () {
            var $this = $(this);
            var data = $this.data('brepeat');
            var opts = typeof options === 'object' && options;

            if (!data) {
                $this.data('brepeat', (data = new Brepeat(this, $.extend({}, $.fn.brepeat.defaults, opts))));
            }

            if (typeof option === 'string') data[option](val);

            window.brepeat = $this.data('brepeat');
        });
    };

    $.fn.brepeat.defaults = {
        lang: 'en',
        maxRepeatTimes: 30,
        maxOccurrences: 35
    };


    var i18n = {
        en: {
            title: "Repeat",
            dates: {
                days: {
                    su: { name: "Sunday", short: "Sun", min: "Su", letter: "S" },
                    mo: { name: "Monday", short: "Mon", min: "Mo", letter: "M" },
                    tu: { name: "Tuesday", short: "Tue", min: "Tu", letter: "T" },
                    we: { name: "Wednesday", short: "Wed", min: "We", letter: "W" },
                    th: { name: "Thursday", short: "Thu", min: "Th", letter: "T" },
                    fr: { name: "Friday", short: "Fri", min: "Fr", letter: "F" },
                    sa: { name: "Saturday", short: "Sat", min: "Sa", letter: "S" }
                },
                months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
            },
            frequency: "frequency",
            frequencyValues: [ "Daily", "Weekly", "Monthly", "Yearly" ],
            repeatEvery: "Repeat every",
            repeats: "Repeats",
            repeatOn: "Repeat on",
            repeatBy: "Repeat by",
            repeatByDm: "day of the month",
            repeatByDw: "day of the week",
            day: "day",
            days: "days",
            weeks: "weeks",
            months: "months",
            years: "years",
            weekdays: "weekdays",
            weekend: "weekend",
            times: "times",
            the: 'the',
            first: 'first',
            second: 'second',
            third: 'third',
            fourth: 'fourth',
            last: 'last',
            on: "On",
            never: "Never",
            after: "After",
            every: "Every",
            until: "until",
            annually: "Annually",
            occurrences: "occurrences",
            specifiedDate: "Specified date",
            startsOn: "Starts on",
            ends: "Ends",
            endsNever: "Ends never",
            endsByOccurrences: "Ends after a number of occurrences",
            endsByDate: "Ends on a specified date",
            summary: "Summary",
            cancel: "Cancel",
            done: "Done",
            edit: "Edit"
        }
    };

    function uiChanged(what, e) {
        var val;
        switch (what) {
            case 'frequency':
                val = this.popup.find('#brepeat-frequency').val();
                this.frequency(val);
                break;

            case 'ends':
                val = this.popup.find('input[name=endson]:checked').val();
                if (val === 'after') {
                    this.ends(val, this.popup.find('#brepeat-endson-after-input').val() || 1);
                } else if (val === 'on') {
                    this.ends(val, this.popup.find('#brepeat-endson-on-input').val()); //TODO: default date
                } else {
                    this.ends(val);
                }
                break;
        }

        this.summary(true);

        this.element.trigger({
            type: 'brepeatChanged',
            what: what,
            newValue: val
        });
    }

    function renderPopup(lang, maxRepeatTimes, maxOccurrences, datepickerType) {
        var popupTemplate = $('<div id="brepeat-popup" class="modal hide fade" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">' +
            '<div class="modal-header">' +
                '<button type="button" class="close" data-dismiss="modal" aria-hidden="true">×</button>' +
                '<h3 id="myModalLabel">' + lang.title + '</h3>' +
            '</div>' +
            '<div class="modal-body">' +
                '<table>' +
                    '<tr>' +
                        '<th>' + lang.repeats + ':</th>' +
                        '<td>' +
                            '<select id="brepeat-frequency"></select>' +
                        '</td>' +
                    '</tr>' +
                    '<tr>' +
                        '<th>' + lang.repeatEvery + ':</th>' +
                        '<td>' +
                            '<select id="brepeat-interval"></select>' +
                            '<label>' + lang.weeks + '</label>' +
                        '</td>' +
                    '</tr>' +
                    '<tr style="display:none;">' +
                        '<th>' + lang.repeatBy + ':</th>' +
                        '<td>' +
                            '<span><input id="brepeat-by-dm" name="repeatby" type="radio" value="dm" title="' + lang.repeatByDm + '" checked><label for="brepeat-by-dm" title="' + lang.repeatByDm + '">' + lang.repeatByDm + '</label></span>' +
                            '<span><input id="brepeat-by-dw" name="repeatby" type="radio" value="dw" title="' + lang.repeatByDw + '"><label for="brepeat-by-dw" title="' + lang.repeatByDw + '">' + lang.repeatByDw + '</label></span>' +
                        '</td>' +
                    '</tr>' +
                    '<tr style="display:none;">' +
                        '<th>' + lang.repeatOn + ':</th>' +
                        '<td id="brepeat-on"></td>' +
                    '</tr>' +
                    '<tr tabindex="0">' +
                        '<th>' + lang.startsOn + ':</th>' +
                        '<td><input id="brepeat-starton"></td>' +
                    '</tr>' +
                    '<tr>' +
                        '<th>' + lang.ends + ':</th>' +
                        '<td>' +
                            '<div class="ends-row"><input id="brepeat-endson-never" name="endson" type="radio" value="never" title="' + lang.endsNever + '" checked><label for="brepeat-endson-never" title="' + lang.endsNever + '">' + lang.never + '</label></div>' +
                            '<div class="ends-row"><input id="brepeat-endson-after" name="endson" type="radio" value="after" title="' + lang.endsByOccurrences + '"><label for="brepeat-endson-after" title="' + lang.endsByOccurrences + '">' + lang.after + ' <input id="brepeat-endson-after-input" size="3" disabled="" value="' + maxOccurrences + '"> ' + lang.occurrences + '</label></div>' +
                            '<div class="ends-row"><input id="brepeat-endson-on" name="endson" type="radio" value="on" title="' + lang.endsByDate + '"><label for="brepeat-endson-on" title="' + lang.endsByDate + '">' + lang.on + ' <input id="brepeat-endson-on-input" size="10" value="" disabled="" title="' + lang.specifiedDate + '" /></label></div>' +
                        '</td>' +
                    '</tr>' +
                    '<tr tabindex="0" id="brepeat-summary">' +
                        '<th>' + lang.summary + ':</th>' +
                        '<td></td>' +
                    '</tr>' +
                '</table>' +
            '</div>' +
            '<div class="modal-footer">' +
                '<button class="btn cancel" aria-hidden="true">' + lang.cancel + '</button>' +
                '<button class="btn btn-primary done">' + lang.done + '</button>' +
            '</div>' +
        '</div>');

        $.each(i18n.en.frequencyValues, function(i, freq) {
            $('<option value="' + freq.toLowerCase() + '" title="' + lang.frequencyValues[i] + '">' + lang.frequencyValues[i] + '</option>').appendTo(popupTemplate.find('#brepeat-frequency'));
        });

        $.map(i18n.en.dates.days, function(day, i) {
            $('<span><input id="brepeat-repeaton-' + i + '" name="' + day.min.toLowerCase() + '" type="checkbox" title="' + lang.dates.days[i].name + '"><label for="" title="' + lang.dates.days[i].name + '">' + lang.dates.days[i].letter + '</label></span>').appendTo(popupTemplate.find('#brepeat-on'));
        });

        for (var i=0; i<maxRepeatTimes; i++) {
            $('<option value="' + (i+1) + '">' + (i+1) + '</option>').appendTo(popupTemplate.find('#brepeat-interval'));
        }

        if (datepickerType === 'datetimepicker') {
            popupTemplate.find('#brepeat-starton').parent().html('<div id="brepeat-starton" class="input-append date">' +
                '<input name="brepeat-starton" data-format="yyyy-MM-dd hh:mm:ss" type="text"></input>' +
                '<span class="add-on">' +
                  '<i data-time-icon="icon-time" data-date-icon="icon-calendar">' +
                  '</i>' +
                '</span>' +
            '</div>');

            popupTemplate.find('#brepeat-endson-on-input').replaceWith('<div id="brepeat-endson-on-date" class="input-append date">' +
                '<input data-format="yyyy-MM-dd hh:mm:ss" type="text"></input>' +
                '<span class="add-on">' +
                  '<i data-time-icon="icon-time" data-date-icon="icon-calendar">' +
                  '</i>' +
                '</span>' +
            '</div>');
        } else if (datepickerType === 'datepicker') {
            //TODO: datepicker markup
        }


        return popupTemplate;
    }

}( window.jQuery );