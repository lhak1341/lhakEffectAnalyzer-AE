(function (thisObj) {
  /************************************************************
   * CONSTANTS AND CONFIGURATION
   ************************************************************/
  var CONFIG = {
    META: {
      SCRIPT_NAME: 'Effect Usage Analyzer',
      VERSION: 'v0.0.5',
      DESCRIPTION:
        'Analyzes and displays all effects used in the active project with location details',
    },

    UI: {
      WINDOW: {
        WIDTH: 650,
        HEIGHT: 500,
        MARGINS: 15,
        SPACING: 8,
      },
      PANEL: {
        MARGINS: 10,
        SPACING: 6,
      },
      BUTTON: {
        SCAN: 'Scan Project',
        GOTO: 'Go to Layer',
        REFRESH: 'Refresh',
      },
      LABEL: {
        EFFECTS: 'Effects in Project:',
        LOCATIONS: 'Used in:',
        NO_EFFECTS: 'No effects found in project',
        SELECT_EFFECT: 'Select an effect to see locations',
      },
      SEARCH: {
        PLACEHOLDER: 'Search effects...',
        CLEAR: 'Clear',
      },
      LISTBOX: {
        EFFECTS_HEIGHT: 180,
        LOCATIONS_HEIGHT: 200,
      },
      EFFECTS_TABLE: {
        COLUMN_WIDTHS: [200, 180, 60], // Effect, matchName, Count
        COLUMN_TITLES: ['Effect', 'matchName', 'Count'],
      },
      LOCATIONS_TABLE: {
        COLUMN_WIDTHS: [150, 150, 120, 80], // Comp, Layer, Custom Name, Status
        COLUMN_TITLES: ['Composition', 'Layer', 'Custom Name', 'Status'],
      },
    },

    ALERT: {
      SUCCESS: 'Project scan completed successfully',
      ERROR_GENERIC: 'An error occurred: ',
      NO_PROJECT: 'Please open a project first',
      NO_COMPOSITION: 'No compositions found in project',
      NO_EFFECT_SELECTED: 'Please select an effect first',
      NO_LOCATION_SELECTED: 'Please select a location first',
      LAYER_NOT_FOUND: 'Layer could not be found or accessed',
    },
  };

  /************************************************************
   * GLOBAL VARIABLES
   ************************************************************/
  var ui = null;
  var effectsData = {};
  var currentProject = null;

  /************************************************************
   * INITIALIZATION
   ************************************************************/
  function init() {
    if (!validateProjectState()) {
      return;
    }

    ui = createUI(thisObj);
    buildUI();
    bindEvents();

    // Perform initial scan before showing UI
    scanProject();
    showUI();
  }

  /************************************************************
   * UI CREATION FUNCTIONS
   ************************************************************/

  /**
   * Creates the main UI window/panel
   * @param {Object} thisObj - ExtendScript 'this' object
   * @returns {Object} UI object with all control references
   */
  function createUI(thisObj) {
    var win;

    if (thisObj instanceof Panel) {
      win = thisObj;
    } else {
      // Use 'palette' type for a modeless floating window
      win = new Window('palette', CONFIG.META.SCRIPT_NAME);

      win.orientation = 'column';
      win.alignChildren = ['fill', 'top'];
      win.spacing = CONFIG.UI.WINDOW.SPACING;
      win.margins = CONFIG.UI.WINDOW.MARGINS;
      win.preferredSize.width = CONFIG.UI.WINDOW.WIDTH;
      win.preferredSize.height = CONFIG.UI.WINDOW.HEIGHT;
    }

    return {
      window: win,
      // UI elements will be added during buildUI
    };
  }

  /**
   * Builds the complete user interface
   */
  function buildUI() {
    ui.window.orientation = 'column';
    ui.window.alignChildren = ['fill', 'top'];
    ui.window.spacing = CONFIG.UI.WINDOW.SPACING;

    buildEffectsPanel();
    buildLocationsPanel();

    ui.title = ui.window.add('statictext', undefined, CONFIG.META.VERSION);
    ui.title.alignment = ['center', 'top'];
  }

  /**
   * Builds the effects selection panel
   */
  function buildEffectsPanel() {
    var effectsPnl = ui.window.add('panel', undefined, CONFIG.UI.LABEL.EFFECTS);
    effectsPnl.orientation = 'column';
    effectsPnl.alignChildren = ['fill', 'top'];
    effectsPnl.margins = CONFIG.UI.PANEL.MARGINS;
    effectsPnl.spacing = CONFIG.UI.PANEL.SPACING;

    // Add search box
    var searchGrp = effectsPnl.add('group');
    searchGrp.orientation = 'row';
    searchGrp.alignment = 'fill';
    searchGrp.spacing = CONFIG.UI.PANEL.SPACING;

    ui.searchBox = searchGrp.add('edittext', undefined, '');
    ui.searchBox.helpTip = CONFIG.UI.SEARCH.PLACEHOLDER;
    ui.searchBox.alignment = ['fill', 'center']; // This makes it expand to fill available space

    ui.clearSearchBtn = searchGrp.add(
      'button',
      undefined,
      CONFIG.UI.SEARCH.CLEAR
    );
    ui.clearSearchBtn.alignment = ['right', 'center']; // Keep button at natural size

    // Create table-style listbox for effects
    ui.effectsListBox = effectsPnl.add('listbox', undefined, undefined, {
      name: 'effectsTable',
      multiselect: false,
      numberOfColumns: 3,
      columnWidths: CONFIG.UI.EFFECTS_TABLE.COLUMN_WIDTHS,
      columnTitles: CONFIG.UI.EFFECTS_TABLE.COLUMN_TITLES,
      showHeaders: true,
    });
    ui.effectsListBox.preferredSize.height = CONFIG.UI.LISTBOX.EFFECTS_HEIGHT;
  }

  /**
   * Builds the locations display panel with table format
   */
  function buildLocationsPanel() {
    var locationsPnl = ui.window.add(
      'panel',
      undefined,
      CONFIG.UI.LABEL.LOCATIONS
    );
    locationsPnl.orientation = 'column';
    locationsPnl.alignChildren = ['fill', 'top'];
    locationsPnl.margins = CONFIG.UI.PANEL.MARGINS;
    locationsPnl.spacing = CONFIG.UI.PANEL.SPACING;

    // Create table-style listbox
    ui.locationsListBox = locationsPnl.add('listbox', undefined, undefined, {
      name: 'locationsTable',
      multiselect: false,
      numberOfColumns: 4,
      columnWidths: CONFIG.UI.LOCATIONS_TABLE.COLUMN_WIDTHS,
      columnTitles: CONFIG.UI.LOCATIONS_TABLE.COLUMN_TITLES,
      showHeaders: true,
    });
    ui.locationsListBox.preferredSize.height =
      CONFIG.UI.LISTBOX.LOCATIONS_HEIGHT;

    var btnGrp = locationsPnl.add('group');
    btnGrp.alignment = 'fill';
    btnGrp.spacing = CONFIG.UI.PANEL.SPACING;

    ui.gotoBtn = btnGrp.add('button', undefined, CONFIG.UI.BUTTON.GOTO);
    ui.gotoBtn.enabled = false;

    ui.refreshBtn = btnGrp.add('button', undefined, CONFIG.UI.BUTTON.REFRESH);
  }

  /**
   * Shows the UI window
   */
  function showUI() {
    if (ui.window instanceof Window) {
      ui.window.center();
      ui.window.show();
    } else {
      ui.window.layout.layout(true);
    }
  }

  /************************************************************
   * EVENT HANDLER FUNCTIONS
   ************************************************************/

  /**
   * Binds all event handlers to UI elements
   */
  function bindEvents() {
    ui.effectsListBox.onChange = handleEffectSelection;
    ui.locationsListBox.onChange = handleLocationSelection;
    ui.gotoBtn.onClick = handleGotoLayer;
    ui.refreshBtn.onClick = handleRefresh;

    // Add search event handlers
    ui.searchBox.onChanging = handleSearch; // Real-time search as user types
    ui.clearSearchBtn.onClick = handleClearSearch;
  }

  /**
   * Filters the effects list based on search term
   * @param {string} searchTerm - The search term to filter by
   */
  function filterEffectsList(searchTerm) {
    ui.effectsListBox.removeAll();

    var effectsArray = [];
    for (var matchName in effectsData) {
      if (effectsData.hasOwnProperty(matchName)) {
        var displayName =
          effectsData[matchName].originalName ||
          getDisplayNameFromMatchName(matchName);
        var count = effectsData[matchName].instances.length;

        // Filter based on search term (case insensitive)
        if (
          searchTerm === '' ||
          displayName.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1 ||
          matchName.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1
        ) {
          effectsArray.push({
            displayName: displayName,
            matchName: matchName,
            count: count,
          });
        }
      }
    }

    effectsArray.sort(function (a, b) {
      return a.displayName.localeCompare(b.displayName);
    });

    for (var i = 0; i < effectsArray.length; i++) {
      var effect = effectsArray[i];

      var tableRow = ui.effectsListBox.add('item', effect.displayName);
      tableRow.subItems[0].text = effect.matchName;
      tableRow.subItems[1].text = effect.count.toString();

      tableRow.effectData = {
        displayName: effect.displayName,
        matchName: effect.matchName,
      };
    }

    if (effectsArray.length === 0) {
      var noResultsText =
        searchTerm === ''
          ? CONFIG.UI.LABEL.NO_EFFECTS
          : 'No effects match your search';
      var noEffectsRow = ui.effectsListBox.add('item', noResultsText);
      noEffectsRow.subItems[0].text = '';
      noEffectsRow.subItems[1].text = '';
    }

    // Clear location list when search changes
    clearLocationsList();
    ui.gotoBtn.enabled = false;
  }

  /**
   * Handles search box input
   */
  function handleSearch() {
    var searchTerm = ui.searchBox.text;
    filterEffectsList(searchTerm);
  }

  /**
   * Clears the search box and shows all effects
   */
  function handleClearSearch() {
    ui.searchBox.text = '';
    filterEffectsList('');
  }

  /**
   * Handles effect selection from dropdown
   */
  function handleEffectSelection() {
    var selectedEffect = ui.effectsListBox.selection;
    if (!selectedEffect || !selectedEffect.effectData) {
      clearLocationsList();
      ui.gotoBtn.enabled = false;
      return;
    }

    var matchName = selectedEffect.effectData.matchName;
    populateLocationsList(matchName);
    ui.gotoBtn.enabled = false;
  }

  /**
   * Handles location selection from list
   */
  function handleLocationSelection() {
    var selectedLocation = ui.locationsListBox.selection;
    ui.gotoBtn.enabled = selectedLocation !== null;
  }

  /**
   * Handles navigation to selected layer
   */
  function handleGotoLayer() {
    var selectedEffect = ui.effectsListBox.selection;
    var selectedLocation = ui.locationsListBox.selection;

    if (!selectedEffect || !selectedLocation) {
      alert(CONFIG.ALERT.NO_LOCATION_SELECTED);
      return;
    }

    var matchName = selectedEffect.effectData.matchName;
    var locationIndex = selectedLocation.index;

    navigateToLayer(matchName, locationIndex);
  }

  /**
   * Handles refresh button click
   */
  function handleRefresh() {
    scanProject();
  }

  /************************************************************
   * CORE FUNCTIONALITY - PROJECT SCANNING
   ************************************************************/

  /**
   * Scans the active project for all effects usage
   */
  function scanProject() {
    app.beginUndoGroup('Scan Project Effects');

    try {
      effectsData = {};

      if (!app.project) {
        throw new Error(CONFIG.ALERT.NO_PROJECT);
      }

      currentProject = app.project;
      var effectsFound = scanAllCompositions();

      populateEffectsList();
      clearLocationsList();

      var effectCount = 0;
      for (var key in effectsData) {
        if (effectsData.hasOwnProperty(key)) {
          effectCount++;
        }
      }

      if (effectCount === 0) {
        ui.effectsListBox.removeAll();
        ui.effectsListBox.add('item', CONFIG.UI.LABEL.NO_EFFECTS);
      }
    } catch (error) {
      alert(CONFIG.ALERT.ERROR_GENERIC + error.toString());
    } finally {
      app.endUndoGroup();
    }
  }

  /**
   * Scans all compositions in the project
   * @returns {boolean} True if effects were found
   */
  function scanAllCompositions() {
    var effectsFound = false;

    for (var i = 1; i <= app.project.items.length; i++) {
      var item = app.project.items[i];

      if (item instanceof CompItem) {
        if (scanComposition(item)) {
          effectsFound = true;
        }
      }
    }

    return effectsFound;
  }

  /**
   * Scans a single composition for effects
   * @param {CompItem} comp - Composition to scan
   * @returns {boolean} True if effects were found in this comp
   */
  function scanComposition(comp) {
    var effectsFound = false;

    for (var layerIndex = 1; layerIndex <= comp.layers.length; layerIndex++) {
      var layer = comp.layers[layerIndex];

      if (scanLayer(comp, layer, layerIndex)) {
        effectsFound = true;
      }
    }

    return effectsFound;
  }

  /**
   * Scans a single layer for effects
   * @param {CompItem} comp - Parent composition
   * @param {Layer} layer - Layer to scan
   * @param {number} layerIndex - Layer index in composition
   * @returns {boolean} True if effects were found on this layer
   */
  function scanLayer(comp, layer, layerIndex) {
    var effectsFound = false;

    if (layer.Effects && layer.Effects.numProperties > 0) {
      for (
        var effectIndex = 1;
        effectIndex <= layer.Effects.numProperties;
        effectIndex++
      ) {
        var effect = layer.Effects.property(effectIndex);
        var effectMatchName = effect.matchName;

        if (!effectsData[effectMatchName]) {
          effectsData[effectMatchName] = {
            instances: [],
            originalName: null,
            isBuiltIn: isBuiltInEffect(effectMatchName),
          };
        }

        // Try to determine the original effect name (not custom renamed)
        if (!effectsData[effectMatchName].originalName) {
          effectsData[effectMatchName].originalName =
            determineOriginalEffectName(effect);
        }

        effectsData[effectMatchName].instances.push({
          comp: comp,
          compName: comp.name,
          layer: layer,
          layerName: layer.name,
          layerIndex: layerIndex,
          effectIndex: effectIndex,
          enabled: effect.enabled,
          displayName: effect.name, // Store the custom name for display
        });

        effectsFound = true;
      }
    }

    return effectsFound;
  }

  /************************************************************
   * CORE FUNCTIONALITY - UI POPULATION
   ************************************************************/

  /**
   * Populates the effects dropdown with found effects
   */
  function populateEffectsList() {
    // Clear search box when repopulating (e.g., after refresh)
    ui.searchBox.text = '';
    filterEffectsList('');
  }

  /**
   * Populates the locations table for selected effect
   * @param {string} effectName - Name of the selected effect
   */
  function populateLocationsList(effectName) {
    ui.locationsListBox.removeAll();

    // effectName parameter is already the matchName, so use it directly
    var matchName = effectName;
    if (!effectsData[matchName]) {
      return;
    }

    var locations = effectsData[matchName].instances;

    for (var i = 0; i < locations.length; i++) {
      var location = locations[i];

      // Determine custom name display
      var customName = '';
      if (
        location.displayName &&
        location.displayName !== effectsData[matchName].originalName
      ) {
        customName = location.displayName;
      }

      // Determine status
      var status = location.enabled ? 'Enabled' : 'Disabled';

      // Create table row - first column is the main item
      var tableRow = ui.locationsListBox.add('item', location.compName);

      // Populate remaining columns via subItems
      tableRow.subItems[0].text = location.layerName; // Layer column
      tableRow.subItems[1].text = customName; // Custom Name column
      tableRow.subItems[2].text = status; // Status column

      // Store location data for navigation
      tableRow.locationData = location;
    }
  }

  /**
   * Clears the locations list
   */
  function clearLocationsList() {
    ui.locationsListBox.removeAll();
  }

  /************************************************************
   * CORE FUNCTIONALITY - NAVIGATION
   ************************************************************/

  /**
   * Navigates to the specified layer in After Effects
   * @param {string} effectName - Name of the effect
   * @param {number} locationIndex - Index in the locations array
   */
  function navigateToLayer(effectName, locationIndex) {
    try {
      var selectedLocation = ui.locationsListBox.selection;
      if (!selectedLocation || !selectedLocation.locationData) {
        throw new Error(CONFIG.ALERT.LAYER_NOT_FOUND);
      }

      var location = selectedLocation.locationData;
      var comp = location.comp;
      var layer = location.layer;

      // Clear existing selections
      for (var i = 1; i <= comp.layers.length; i++) {
        comp.layers[i].selected = false;
      }

      // Open composition and select the layer
      comp.openInViewer();
      var layerInComp = comp.layer(location.layerIndex);
      layerInComp.selected = true;
    } catch (error) {
      alert(CONFIG.ALERT.ERROR_GENERIC + error.toString());
    }
  }

  /************************************************************
   * UTILITY FUNCTIONS
   ************************************************************/

  /**
   * Validates that a project is open and accessible
   * @returns {boolean} True if project state is valid
   */
  function validateProjectState() {
    if (!app.project) {
      alert(CONFIG.ALERT.NO_PROJECT);
      return false;
    }

    return true;
  }

  /**
   * Gets the display name from a match name for UI display
   * @param {string} matchName - The effect's match name
   * @returns {string} User-friendly display name
   */
  function getDisplayNameFromMatchName(matchName) {
    // Use the stored original name if available
    if (effectsData[matchName] && effectsData[matchName].originalName) {
      return effectsData[matchName].originalName;
    }

    // For built-in effects, use hardcoded mapping
    if (isBuiltInEffect(matchName)) {
      return getBuiltInEffectName(matchName);
    }

    // For third-party effects, clean up the matchName
    return cleanupThirdPartyEffectName(matchName);
  }

  /**
   * Gets the match name from a display name
   * @param {string} displayName - The user-friendly display name
   * @returns {string} The corresponding match name
   */
  function getMatchNameFromDisplayName(displayName) {
    for (var matchName in effectsData) {
      if (effectsData.hasOwnProperty(matchName)) {
        var originalName =
          effectsData[matchName].originalName ||
          getDisplayNameFromMatchName(matchName);
        if (originalName === displayName) {
          return matchName;
        }
      }
    }
    return displayName; // Fallback if not found
  }

  /**
   * Determines if an effect is a built-in After Effects effect
   * @param {string} matchName - The effect's match name
   * @returns {boolean} True if it's a built-in effect
   */
  function isBuiltInEffect(matchName) {
    return matchName.indexOf('ADBE') === 0;
  }

  /**
   * Attempts to determine the original effect name from the effect object
   * @param {Property} effect - The effect property
   * @returns {string} The best guess at the original effect name
   */
  function determineOriginalEffectName(effect) {
    var matchName = effect.matchName;
    var currentName = effect.name;

    // For built-in effects, use our mapping
    if (isBuiltInEffect(matchName)) {
      return getBuiltInEffectName(matchName);
    }

    // For third-party effects, try to detect if it's been renamed
    // by checking if the current name looks like a default effect name
    if (isLikelyOriginalPluginName(currentName, matchName)) {
      return currentName;
    }

    // Fallback: clean up the matchName for third-party effects
    return cleanupThirdPartyEffectName(matchName);
  }

  /**
   * Gets the built-in effect name from our hardcoded mapping
   * @param {string} matchName - The effect's match name
   * @returns {string} The built-in effect name
   */
  function getBuiltInEffectName(matchName) {
    // Comprehensive mapping for built-in effects
    var displayNames = {
      // 3D Channel
      'ADBE AUX CHANNEL EXTRACT': '3D Channel Extract',
      'ADBE DEPTH MATTE': 'Depth Matte',
      'ADBE DEPTH FIELD': 'Depth of Field',
      EXtractoR: 'EXtractoR',
      'ADBE FOG_3D': 'Fog 3D',
      'ADBE ID MATTE': 'ID Matte',
      IDentifier: 'IDentifier',

      // Audio
      'ADBE Aud Reverse': 'Backwards',
      'ADBE Aud BT': 'Bass & Treble',
      'ADBE Aud Delay': 'Delay',
      'ADBE Aud_Flange': 'Flange & Chorus',
      'ADBE Aud HiLo': 'High-Low Pass',
      'ADBE Aud Modulator': 'Modulator',
      'ADBE Param EQ': 'Parametric EQ',
      'ADBE Aud Reverb': 'Reverb',
      'ADBE Aud Stereo Mixer': 'Stereo Mixer',
      'ADBE Aud Tone': 'Tone',

      // Blur & Sharpen
      'ADBE Bilateral': 'Bilateral Blur',
      'ADBE Camera Lens Blur': 'Camera Lens Blur',
      'ADBE CameraShakeDeblur': 'Camera-Shake Deblur',
      'CS CrossBlur': 'CC Cross Blur',
      'CC Radial Blur': 'CC Radial Blur',
      'CC Radial Fast Blur': 'CC Radial Fast Blur',
      'CC Vector Blur': 'CC Vector Blur',
      'ADBE Channel Blur': 'Channel Blur',
      'ADBE Compound Blur': 'Compound Blur',
      'ADBE Motion Blur': 'Directional Blur',
      'ADBE Box Blur2': 'Fast Box Blur',
      'ADBE Gaussian Blur 2': 'Gaussian Blur',
      'ADBE Radial Blur': 'Radial Blur',
      'ADBE Sharpen': 'Sharpen',
      'ADBE Smart Blur': 'Smart Blur',
      'ADBE Unsharp Mask2': 'Unsharp Mask',

      // Channel
      'ADBE Arithmetic': 'Arithmetic',
      'ADBE Blend': 'Blend',
      'ADBE Calculations': 'Calculations',
      'CC Composite': 'CC Composite',
      'ADBE Channel Combiner': 'Channel Combiner',
      'ADBE Compound Arithmetic': 'Compound Arithmetic',
      'ADBE Invert': 'Invert',
      'ADBE Minimax': 'Minimax',
      'ADBE Remove Color Matting': 'Remove Color Matting',
      'ADBE Set Channels': 'Set Channels',
      'ADBE Set Matte3': 'Set Matte',
      'ADBE Shift Channels': 'Shift Channels',
      'ADBE Solid Composite': 'Solid Composite',

      // CINEMA 4D
      'CINEMA 4D Effect': 'CINEWARE',

      // Color Correction
      'ADBE AutoColor': 'Auto Color',
      'ADBE AutoContrast': 'Auto Contrast',
      'ADBE AutoLevels': 'Auto Levels',
      'ADBE Black&White': 'Black & White',
      'ADBE Brightness & Contrast 2': 'Brightness & Contrast',
      'ADBE Broadcast Colors': 'Broadcast Colors',
      'CS Color Neutralizer': 'CC Color Neutralizer',
      'CC Color Offset': 'CC Color Offset',
      'CS Kernel': 'CC Kernel',
      'CC Toner': 'CC Toner',
      'ADBE Change Color': 'Change Color',
      'ADBE Change To Color': 'Change to Color',
      'ADBE CHANNEL MIXER': 'Channel Mixer',
      'ADBE Color Balance 2': 'Color Balance',
      'ADBE Color Balance (HLS)': 'Color Balance (HLS)',
      'ADBE Color Link': 'Color Link',
      'ADBE Deflicker': 'Color Stabilizer',
      'APC Colorama': 'Colorama',
      'ADBE CurvesCustom': 'Curves',
      'ADBE Equalize': 'Equalize',
      'ADBE Exposure2': 'Exposure',
      'ADBE Gamma/Pedestal/Gain2': 'Gamma/Pedestal/Gain',
      'ADBE HUE SATURATION': 'Hue/Saturation',
      'ADBE Leave Color': 'Leave Color',
      'ADBE Easy Levels2': 'Levels',
      'ADBE Pro Levels2': 'Levels (Individual Controls)',
      'ADBE Lumetri': 'Lumetri Color',
      'ADBE PhotoFilterPS': 'Photo Filter',
      'ADBE PS Arbitrary Map': 'PS Arbitrary Map',
      'ADBE SelectiveColor': 'Selective Color',
      'ADBE ShadowHighlight': 'Shadow/Highlight',
      'ADBE Tint': 'Tint',
      'ADBE Tritone': 'Tritone',
      'ADBE Vibrance': 'Vibrance',

      // Distort
      'ADBE BEZMESH': 'Bezier Warp',
      'ADBE Bulge': 'Bulge',
      'CC Bend It': 'CC Bend It',
      'CC Bender': 'CC Bender',
      'CC Blobbylize': 'CC Blobbylize',
      'CC Flo Motion': 'CC Flo Motion',
      'CC Griddler': 'CC Griddler',
      'CC Lens': 'CC Lens',
      'CC Page Turn': 'CC Page Turn',
      'CC Power Pin': 'CC Power Pin',
      'CC Ripple Pulse': 'CC Ripple Pulse',
      'CC Slant': 'CC Slant',
      'CC Smear': 'CC Smear',
      'CC Split': 'CC Split',
      'CC Split 2': 'CC Split 2',
      'CC Tiler': 'CC Tiler',
      'ADBE Corner Pin': 'Corner Pin',
      'ADBE Upscale': 'Detail-preserving Upscale',
      'ADBE Displacement Map': 'Displacement Map',
      'ADBE LIQUIFY': 'Liquify',
      'ADBE Magnify': 'Magnify',
      'ADBE MESH WARP': 'Mesh Warp',
      'ADBE Mirror': 'Mirror',
      'ADBE Offset': 'Offset',
      'ADBE Optics Compensation': 'Optics Compensation',
      'ADBE Polar Coordinates': 'Polar Coordinates',
      'ADBE RESHAPE': 'Reshape',
      'ADBE Ripple': 'Ripple',
      'ADBE Rolling Shutter': 'Rolling Shutter Repair',
      'ADBE SCHMEAR': 'Smear',
      'ADBE Spherize': 'Spherize',
      'ADBE Geometry2': 'Transform',
      'ADBE Turbulent Displace': 'Turbulent Displace',
      'ADBE Twirl': 'Twirl',
      'ADBE WRPMESH': 'Warp',
      'ADBE SubspaceStabilizer': 'Warp Stabilizer VFX',
      'ADBE Wave Warp': 'Wave Warp',

      // Expression Controls
      'ADBE Point3D Control': '3D Point Control',
      'ADBE Angle Control': 'Angle Control',
      'ADBE Checkbox Control': 'Checkbox Control',
      'ADBE Color Control': 'Color Control',
      'ADBE Dropdown Control': 'Dropdown Control',
      'ADBE Layer Control': 'Layer Control',
      'ADBE Point Control': 'Point Control',
      'ADBE Slider Control': 'Slider Control',

      // Generate
      'ADBE 4ColorGradient': '4-Color Gradient',
      'ADBE Lightning 2': 'Advanced Lightning',
      'ADBE AudSpect': 'Audio Spectrum',
      'ADBE AudWave': 'Audio Waveform',
      'ADBE Laser': 'Beam',
      'CC Glue Gun': 'CC Glue Gun',
      'CC Light Burst 2.5': 'CC Light Burst 2.5',
      'CC Light Rays': 'CC Light Rays',
      'CC Light Sweep': 'CC Light Sweep',
      'CS Threads': 'CC Threads',
      'ADBE Cell Pattern': 'Cell Pattern',
      'ADBE Checkerboard': 'Checkerboard',
      'ADBE Circle': 'Circle',
      'ADBE ELLIPSE': 'Ellipse',
      'ADBE Eyedropper Fill': 'Eyedropper Fill',
      'ADBE Fill': 'Fill',
      'ADBE Fractal': 'Fractal',
      'ADBE Ramp': 'Gradient Ramp',
      'ADBE Grid': 'Grid',
      'ADBE Lens Flare': 'Lens Flare',
      'ADBE Paint Bucket': 'Paint Bucket',
      'APC Radio Waves': 'Radio Waves',
      'ADBE Scribble Fill': 'Scribble',
      'ADBE Stroke': 'Stroke',
      'APC Vegas': 'Vegas',
      'ADBE Write-on': 'Write-on',

      // Keying
      'ADBE Spill2': 'Advanced Spill Suppressor',
      'CC Simple Wire Removal': 'CC Simple Wire Removal',
      'ADBE Color Difference Key': 'Color Difference Key',
      'ADBE Color Range': 'Color Range',
      'ADBE Difference Matte2': 'Difference Matte',
      'ADBE Extract': 'Extract',
      'ADBE ATG Extract': 'Inner/Outer Key',
      'ADBE KeyCleaner': 'Key Cleaner',
      'Keylight 906': 'Keylight (1.2)',
      'ADBE Linear Color Key2': 'Linear Color Key',

      // Matte
      'ADBE Matte Choker': 'Matte Choker',
      'ISL MochaShapeImporter': 'mocha shape',
      'ADBE RefineRBMatte': 'Refine Hard Matte',
      'ADBE RefineMatte2': 'Refine Soft Matte',
      'ADBE Simple Choker': 'Simple Choker',

      // Noise & Grain
      'VISINF Grain Implant': 'Add Grain',
      'ADBE Dust & Scratches': 'Dust & Scratches',
      'ADBE Fractal Noise': 'Fractal Noise',
      'VISINF Grain Duplication': 'Match Grain',
      'ADBE Median': 'Median',
      'ADBE Noise': 'Noise',
      'ADBE Noise Alpha2': 'Noise Alpha',
      'ADBE Noise HLS2': 'Noise HLS',
      'ADBE Noise HLS Auto2': 'Noise HLS Auto',
      'VISINF Grain Removal': 'Remove Grain',
      'ADBE AIF Perlin Noise 3D': 'Turbulent Noise',

      // Perspective
      'ADBE 3D Tracker': '3D Camera Tracker',
      'ADBE 3D Glasses2': '3D Glasses',
      'ADBE Bevel Alpha': 'Bevel Alpha',
      'ADBE Bevel Edges': 'Bevel Edges',
      'CC Cylinder': 'CC Cylinder',
      'CC Environment': 'CC Environment',
      'CC Sphere': 'CC Sphere',
      'CC Spotlight': 'CC Spotlight',
      'ADBE Drop Shadow': 'Drop Shadow',
      'ADBE Radial Shadow': 'Radial Shadow',

      // Simulation
      'APC CardDanceCam': 'Card Dance',
      'APC Caustics': 'Caustics',
      'CC Ball Action': 'CC Ball Action',
      'CC Bubbles': 'CC Bubbles',
      'CC Drizzle': 'CC Drizzle',
      'CC Hair': 'CC Hair',
      'CC Mr. Mercury': 'CC Mr. Mercury',
      'CC Particle Systems II': 'CC Particle Systems II',
      'CC Particle World': 'CC Particle World',
      'CC Pixel Polly': 'CC Pixel Polly',
      CSRainfall: 'CC Rainfall',
      'CC Scatterize': 'CC Scatterize',
      CSSnowfall: 'CC Snowfall',
      'CC Star Burst': 'CC Star Burst',
      'APC Foam': 'Foam',
      'ADBE Playgnd': 'Particle Playground',
      'APC Shatter': 'Shatter',
      'APC Wave World': 'Wave World',

      // Stylize
      'ADBE Brush Strokes': 'Brush Strokes',
      'ADBE Cartoonify': 'Cartoon',
      'CS BlockLoad': 'CC Block Load',
      'CC Burn Film': 'CC Burn Film',
      'CC Glass': 'CC Glass',
      'CS HexTile': 'CC HexTile',
      'CC Kaleida': 'CC Kaleida',
      'CC Mr. Smoothie': 'CC Mr. Smoothie',
      'CC Plastic': 'CC Plastic',
      'CC RepeTile': 'CC RepeTile',
      'CC Threshold': 'CC Threshold',
      'CC Threshold RGB': 'CC Threshold RGB',
      'CS Vignette': 'CC Vignette',
      'ADBE Color Emboss': 'Color Emboss',
      'ADBE Emboss': 'Emboss',
      'ADBE Find Edges': 'Find Edges',
      'ADBE Glo2': 'Glow',
      'ADBE Mosaic': 'Mosaic',
      'ADBE Tile': 'Motion Tile',
      'ADBE Posterize': 'Posterize',
      'ADBE Roughen Edges': 'Roughen Edges',
      'ADBE Scatter': 'Scatter',
      'ADBE Strobe': 'Strobe Light',
      'ADBE Texturize': 'Texturize',
      'ADBE Threshold2': 'Threshold',

      // Synthetic Aperture
      'SYNTHAP CF Color Finesse 2': 'SA Color Finesse 3',

      // Text
      'ADBE Numbers2': 'Numbers',
      'ADBE Timecode': 'Timecode',

      // Time
      'CC Force Motion Blur': 'CC Force Motion Blur',
      'CC Wide Time': 'CC Wide Time',
      'ADBE Echo': 'Echo',
      'ADBE OFMotionBlur': 'Pixel Motion Blur',
      'ADBE Posterize Time': 'Posterize Time',
      'ADBE Difference': 'Time Difference',
      'ADBE Time Displacement': 'Time Displacement',
      'ADBE Timewarp': 'Timewarp',

      // Transition
      'ADBE Block Dissolve': 'Block Dissolve',
      'APC CardWipeCam': 'Card Wipe',
      'CC Glass Wipe': 'CC Glass Wipe',
      'CC Grid Wipe': 'CC Grid Wipe',
      'CC Image Wipe': 'CC Image Wipe',
      'CC Jaws': 'CC Jaws',
      'CC Light Wipe': 'CC Light Wipe',
      'CS LineSweep': 'CC Line Sweep',
      'CC Radial ScaleWipe': 'CC Radial ScaleWipe',
      'CC Scale Wipe': 'CC Scale Wipe',
      'CC Twister': 'CC Twister',
      'CC WarpoMatic': 'CC WarpoMatic',
      'ADBE Gradient Wipe': 'Gradient Wipe',
      'ADBE IRIS_WIPE': 'Iris Wipe',
      'ADBE Linear Wipe': 'Linear Wipe',
      'ADBE Radial Wipe': 'Radial Wipe',
      'ADBE Venetian Blinds': 'Venetian Blinds',

      // Utility
      'ADBE Apply Color LUT2': 'Apply Color LUT',
      'CC Overbrights': 'CC Overbrights',
      'ADBE Cineon Converter2': 'Cineon Converter',
      'ADBE ProfileToProfile': 'Color Profile Converter',
      'ADBE GROW BOUNDS': 'Grow Bounds',
      'ADBE Compander': 'HDR Compander',
      'ADBE HDR ToneMap': 'HDR Highlight Compression',

      // Obsolete Effects
      'ADBE Basic 3D': 'Basic 3D',
      'ADBE Basic Text2': 'Basic Text',
      'ADBE Color Key': 'Color Key',
      'ADBE Fast Blur': 'Fast Blur (Legacy)',
      'ADBE Gaussian Blur': 'Gaussian Blur (Legacy)',
      'ADBE Lightning': 'Lightning',
      'ADBE Luma Key': 'Luma Key',
      'ADBE Path Text': 'Path Text',
      'ADBE Reduce Interlace Flicker': 'Reduce Interlace Flicker',
      'ADBE Spill Suppressor': 'Spill Suppressor',

      // _Obsolete (Internal Effects)
      'ADBE Paint': 'Paint',
      'ADBE Samurai': 'Roto Brush & Refine Edge',
      'ADBE FreePin3': 'Puppet',
      'ADBE RefineMatte': 'Refine Matte',
      'ADBE 3D Glasses': '3D Glasses (Obsolete)',
      'ADBE Alpha Levels2': 'Alpha Levels',
      'ADBE Alpha Levels3': 'Alpha Levels',
      'ADBE Apply Color LUT': 'Apply Color LUT',
      'ADBE Brightness & Contrast': 'Brightness & Contrast',
      'ADBE Box Blur': 'Box Blur',
      'ADBE Cineon Converter': 'Cineon Converter',
      'ADBE Color Balance': 'Color Balance',
      'CC PS Classic': 'CC PS Classic (obsolete)',
      'CC PS LE Classic': 'CC PS LE Classic (obsolete)',
      'CC Rain': 'CC Rain',
      'CC Snow': 'CC Snow',
      'CC Time Blend': 'CC Time Blend',
      'CC Time Blend FX': 'CC Time Blend FX',
      'ADBE Exposure': 'Exposure',
      'ADBE Easy Levels': 'Levels',
      'ADBE Pro Levels': 'Levels (Individual Controls)',
      'ADBE Noise Alpha': 'Noise Alpha',
      'ADBE Noise HLS': 'Noise HLS',
      'ADBE Noise HLS Auto': 'Noise HLS Auto',
      'ADBE PSL Bevel Emboss': 'Photoshop Bevel And Emboss',
      'ADBE PSL Drop Shadow': 'Photoshop Drop Shadow',
      'ADBE PSL Inner Glow': 'Photoshop Inner Glow',
      'ADBE PSL Inner Shadow': 'Photoshop Inner Shadow',
      'ADBE PSL Outer Glow': 'Photoshop Outer Glow',
      'ADBE PSL Solid Fill': 'Photoshop Solid Fill',
      'ADBE Photo Filter': 'Photo Filter',
      'ADBE Set Matte2': 'Set Matte',
      'ADBE Three-Way Color Corrector': 'Three-Way Color Corrector',
      'ADBE Threshold': 'Threshold',
      'ADBE Geometry': 'Transform',
      'ADBE Unsharp Mask': 'Unsharp Mask',
      'ADBE Vector Paint': 'Vector Paint',
    };

    return displayNames[matchName] || cleanupBuiltInEffectName(matchName);
  }

  /**
   * Checks if a name looks like an original plugin name vs a custom rename
   * @param {string} currentName - Current effect name
   * @param {string} matchName - Effect match name
   * @returns {boolean} True if likely original name
   */
  function isLikelyOriginalPluginName(currentName, matchName) {
    // If the name contains typical plugin naming patterns, it's likely original
    if (
      currentName.match(
        /\b(Pro|Plus|Advanced|FX|3D|2D|HD|Ultra|Master|Suite)\b/i
      )
    ) {
      return true;
    }

    // If it contains version numbers, likely original
    if (currentName.match(/\b(v?\d+(\.\d+)*|Version|Ver\.)\b/i)) {
      return true;
    }

    // If it's very similar to the matchName, likely original
    var simplifiedMatch = matchName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    var simplifiedName = currentName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    if (
      simplifiedMatch.indexOf(simplifiedName) !== -1 ||
      simplifiedName.indexOf(simplifiedMatch) !== -1
    ) {
      return true;
    }

    // If it's very short (1-2 words), might be a custom rename
    if (currentName.split(' ').length <= 2 && currentName.length < 15) {
      return false;
    }

    return true; // Default to assuming it's original for third-party
  }

  /**
   * Cleans up third-party effect names from matchName
   * @param {string} matchName - The effect's match name
   * @returns {string} Cleaned up name
   */
  function cleanupThirdPartyEffectName(matchName) {
    // Remove common prefixes and clean up
    var cleaned = matchName;

    // Remove technical prefixes
    cleaned = cleaned.replace(/^(Pseudo\/|DRFL\s|RS\s|RE:|FX_)/i, '');

    // Remove version numbers and technical suffixes
    cleaned = cleaned.replace(
      /\s*(v?\d+(\.\d+)*|Version\s*\d+(\.\d+)*|\d+\.x|\(\d+\))$/i,
      ''
    );

    // Convert underscores and technical formatting to spaces
    cleaned = cleaned.replace(/[_\-]/g, ' ');

    // Clean up multiple spaces and trim whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned || matchName; // Fallback to original if something went wrong
  }

  /**
   * Cleans up built-in effect names from matchName
   * @param {string} matchName - The effect's match name
   * @returns {string} Cleaned up name
   */
  function cleanupBuiltInEffectName(matchName) {
    var cleaned = matchName.replace(/^ADBE\s*/, ''); // Remove ADBE prefix
    cleaned = cleaned.replace(/\d+$/, ''); // Remove trailing numbers like "2"

    // Handle special cases before general cleanup
    cleaned = cleaned.replace(/&/g, ' & '); // Fix ampersands
    cleaned = cleaned.replace(/\//g, '/'); // Keep slashes as-is
    cleaned = cleaned.replace(/\s+/g, ' '); // Clean multiple spaces

    // Only add spaces before capitals if they're not already spaced and not after special chars
    cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Clean up any double spaces and trim whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned || matchName; // Fallback to original if something went wrong
  }

  // Initialize the script
  init();
})(this);
