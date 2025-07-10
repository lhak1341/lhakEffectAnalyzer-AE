(function (thisObj) {
  /************************************************************
   * CONSTANTS AND CONFIGURATION
   ************************************************************/
  var CONFIG = {
    META: {
      SCRIPT_NAME: 'Effect Usage Analyzer',
      VERSION: 'v0.0.1',
      DESCRIPTION:
        'Analyzes and displays all effects used in the active project with location details',
    },

    UI: {
      WINDOW: {
        WIDTH: 450,
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
        CLOSE: 'Close',
      },
      LABEL: {
        EFFECTS: 'Effects in Project:',
        LOCATIONS: 'Used in:',
        STATUS: 'Status: Ready',
        NO_EFFECTS: 'No effects found in project',
        SELECT_EFFECT: 'Select an effect to see locations',
      },
      LISTBOX: {
        HEIGHT: 150,
        LOCATIONS_HEIGHT: 200,
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
  var showMatchNames = false; // Toggle for display vs technical names

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
    var win =
      thisObj instanceof Panel
        ? thisObj
        : new Window('dialog', CONFIG.META.SCRIPT_NAME);

    if (!(thisObj instanceof Panel)) {
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
    buildHeaderPanel();
    buildEffectsPanel();
    buildLocationsPanel();
    buildControlPanel();
  }

  /**
   * Builds the header panel with title and status
   */
  function buildHeaderPanel() {
    var headerGrp = ui.window.add('group');
    headerGrp.orientation = 'column';
    headerGrp.alignChildren = ['fill', 'top'];
    headerGrp.spacing = 4;

    var titleLbl = headerGrp.add(
      'statictext',
      undefined,
      CONFIG.META.SCRIPT_NAME + ' ' + CONFIG.META.VERSION
    );
    titleLbl.justify = 'center';

    ui.statusLabel = headerGrp.add(
      'statictext',
      undefined,
      CONFIG.UI.LABEL.STATUS
    );
    ui.statusLabel.justify = 'center';
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

    // Add radio buttons for display mode
    var toggleGrp = effectsPnl.add('group');
    toggleGrp.alignment = 'center';
    toggleGrp.orientation = 'row';
    toggleGrp.spacing = 15;

    // Radio buttons must be direct children of the same group to work together
    ui.displayModeRadio = toggleGrp.add('radiobutton', undefined, 'Display');
    ui.technicalModeRadio = toggleGrp.add(
      'radiobutton',
      undefined,
      'Technical'
    );

    // Force text to show by setting the text property explicitly
    ui.displayModeRadio.text = 'Display';
    ui.technicalModeRadio.text = 'Technical';

    // Set default to Display mode
    ui.displayModeRadio.value = true;
    ui.technicalModeRadio.value = false;
    showMatchNames = false;

    ui.effectsListBox = effectsPnl.add('listbox');
    ui.effectsListBox.preferredSize.height = CONFIG.UI.LISTBOX.HEIGHT;
    ui.effectsListBox.add('item', CONFIG.UI.LABEL.SELECT_EFFECT);
    ui.effectsListBox.selection = 0;
  }

  /**
   * Builds the locations display panel
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

    ui.locationsListBox = locationsPnl.add('listbox');
    ui.locationsListBox.preferredSize.height =
      CONFIG.UI.LISTBOX.LOCATIONS_HEIGHT;

    var btnGrp = locationsPnl.add('group');
    btnGrp.alignment = 'fill';
    btnGrp.spacing = CONFIG.UI.PANEL.SPACING;

    ui.gotoBtn = btnGrp.add('button', undefined, CONFIG.UI.BUTTON.GOTO);
    ui.gotoBtn.enabled = false;
  }

  /**
   * Builds the control panel with action buttons
   */
  function buildControlPanel() {
    var controlGrp = ui.window.add('group');
    controlGrp.alignment = 'fill';
    controlGrp.spacing = CONFIG.UI.PANEL.SPACING;

    ui.refreshBtn = controlGrp.add(
      'button',
      undefined,
      CONFIG.UI.BUTTON.REFRESH
    );
    controlGrp.add('panel'); // Spacer

    if (!(thisObj instanceof Panel)) {
      ui.closeBtn = controlGrp.add('button', undefined, CONFIG.UI.BUTTON.CLOSE);
      ui.closeBtn.alignment = 'right';
    }
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
    ui.displayModeRadio.onClick = handleDisplayModeChange;
    ui.technicalModeRadio.onClick = handleDisplayModeChange;
    ui.gotoBtn.onClick = handleGotoLayer;
    ui.refreshBtn.onClick = handleRefresh;

    if (ui.closeBtn) {
      ui.closeBtn.onClick = function () {
        ui.window.close();
      };
    }
  }

  /**
   * Handles effect selection from dropdown
   */
  function handleEffectSelection() {
    var selectedEffect = ui.effectsListBox.selection;
    if (!selectedEffect || selectedEffect.index === 0) {
      clearLocationsList();
      ui.gotoBtn.enabled = false;
      return;
    }

    var effectName = selectedEffect.text.replace(/ \(\d+\)$/, ''); // Remove count suffix
    var matchName = showMatchNames
      ? effectName
      : getMatchNameFromDisplayName(effectName);
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

    var effectName = selectedEffect.text.replace(/ \(\d+\)$/, '');
    var matchName = showMatchNames
      ? effectName
      : getMatchNameFromDisplayName(effectName);
    var locationIndex = selectedLocation.index;

    navigateToLayer(matchName, locationIndex);
  }

  /**
   * Handles display mode change between friendly names and technical matchNames
   */
  function handleDisplayModeChange() {
    showMatchNames = ui.technicalModeRadio.value;
    populateEffectsList();
    clearLocationsList();
    ui.gotoBtn.enabled = false;

    var modeText = showMatchNames ? 'technical names' : 'display names';
    updateStatus('Switched to ' + modeText);
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
      updateStatus('Scanning project...');
      effectsData = {};

      if (!app.project) {
        throw new Error(CONFIG.ALERT.NO_PROJECT);
      }

      currentProject = app.project;
      var effectsFound = scanAllCompositions();

      populateEffectsList();
      clearLocationsList();

      var effectCount = Object.keys(effectsData).length;
      updateStatus('Found ' + effectCount + ' unique effects');

      if (effectCount === 0) {
        ui.effectsListBox.removeAll();
        ui.effectsListBox.add('item', CONFIG.UI.LABEL.NO_EFFECTS);
      }
    } catch (error) {
      alert(CONFIG.ALERT.ERROR_GENERIC + error.toString());
      updateStatus('Error during scan');
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
    ui.effectsListBox.removeAll();
    ui.effectsListBox.add('item', CONFIG.UI.LABEL.SELECT_EFFECT);

    var effectNames = [];
    for (var matchName in effectsData) {
      if (effectsData.hasOwnProperty(matchName)) {
        var displayName;
        if (showMatchNames) {
          displayName = matchName; // Show technical matchName
        } else {
          displayName =
            effectsData[matchName].originalName ||
            getDisplayNameFromMatchName(matchName);
        }
        effectNames.push(displayName);
      }
    }

    effectNames.sort();

    for (var i = 0; i < effectNames.length; i++) {
      var effectName = effectNames[i];
      var matchName = showMatchNames
        ? effectName
        : getMatchNameFromDisplayName(effectName);
      var count = effectsData[matchName].instances.length;
      var displayName = effectName + ' (' + count + ')';
      ui.effectsListBox.add('item', displayName);
    }

    ui.effectsListBox.selection = 0;
  }

  /**
   * Populates the locations list for selected effect
   * @param {string} effectName - Name of the selected effect
   */
  function populateLocationsList(effectName) {
    ui.locationsListBox.removeAll();

    var matchName = getMatchNameFromDisplayName(effectName);
    if (!effectsData[matchName]) {
      return;
    }

    var locations = effectsData[matchName].instances;

    for (var i = 0; i < locations.length; i++) {
      var location = locations[i];
      var statusText = location.enabled ? '' : ' (disabled)';
      var customName =
        location.displayName &&
        location.displayName !== effectsData[matchName].originalName
          ? ' [' + location.displayName + ']'
          : '';
      var displayText =
        location.compName +
        ' > ' +
        location.layerName +
        customName +
        statusText;
      ui.locationsListBox.add('item', displayText);
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
      var matchName = getMatchNameFromDisplayName(effectName);
      var locations = effectsData[matchName].instances;
      if (!locations || locationIndex >= locations.length) {
        throw new Error(CONFIG.ALERT.LAYER_NOT_FOUND);
      }

      var location = locations[locationIndex];
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

      updateStatus(
        'Navigated to: ' + location.compName + ' > ' + location.layerName
      );
    } catch (error) {
      alert(CONFIG.ALERT.ERROR_GENERIC + error.toString());
      updateStatus('Failed to navigate to layer');
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
   * Updates the status label
   * @param {string} message - Status message to display
   */
  function updateStatus(message) {
    if (ui && ui.statusLabel) {
      ui.statusLabel.text = 'Status: ' + message;
    }
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
      // Blur & Sharpen
      'ADBE Fast Blur': 'Fast Blur',
      'ADBE Gaussian Blur 2': 'Gaussian Blur',
      'ADBE Motion Blur': 'Motion Blur',
      'ADBE Radial Blur': 'Radial Blur',
      'ADBE Directional Blur': 'Directional Blur',
      'ADBE Camera Lens Blur': 'Camera Lens Blur',
      'ADBE Sharpen': 'Sharpen',
      'ADBE Unsharp Mask': 'Unsharp Mask',

      // Color Correction
      'ADBE Easy Levels2': 'Levels',
      'ADBE Pro Levels2': 'Levels',
      'ADBE Color Correction': 'Color Correction',
      'ADBE Brightness & Contrast 2': 'Brightness & Contrast',
      'ADBE Hue/Saturation': 'Hue/Saturation',
      'ADBE HueSaturation': 'Hue/Saturation',
      'ADBE HUE SATURATION': 'Hue/Saturation',
      'ADBE Curves': 'Curves',
      'ADBE Shadow/Highlight': 'Shadow/Highlight',
      'ADBE Color Balance (HLS)': 'Color Balance (HLS)',
      'ADBE Color Balance 2': 'Color Balance',
      'ADBE Auto Levels': 'Auto Levels',
      'ADBE Auto Color': 'Auto Color',
      'ADBE Auto Contrast': 'Auto Contrast',
      'ADBE Exposure2': 'Exposure',
      'ADBE Gamma/Pedestal/Gain': 'Gamma/Pedestal/Gain',
      'ADBE Lumetri': 'Lumetri Color',
      'ADBE Channel Mixer': 'Channel Mixer',
      'ADBE Photo Filter': 'Photo Filter',
      'ADBE Tint': 'Tint',
      'ADBE Tritone': 'Tritone',
      'ADBE Change Color': 'Change Color',
      'ADBE Change to Color': 'Change to Color',
      'ADBE Leave Color': 'Leave Color',
      'ADBE Black & White': 'Black & White',
      'ADBE Colorama': 'Colorama',

      // Noise & Grain
      'ADBE Noise': 'Noise',
      'ADBE Noise Alpha': 'Noise Alpha',
      'ADBE Noise HLS': 'Noise HLS',
      'ADBE Noise HLS Auto': 'Noise HLS Auto',
      'ADBE Add Grain': 'Add Grain',
      'ADBE Remove Grain': 'Remove Grain',
      'ADBE Match Grain': 'Match Grain',

      // Stylize
      'ADBE Drop Shadow': 'Drop Shadow',
      'ADBE Glow': 'Glow',
      'ADBE Inner Glow': 'Inner Glow',
      'ADBE Outer Glow': 'Outer Glow',
      'ADBE Stroke': 'Stroke',
      'ADBE Roughen Edges': 'Roughen Edges',
      'ADBE Scatter': 'Scatter',
      'ADBE Emboss': 'Emboss',
      'ADBE Find Edges': 'Find Edges',
      'ADBE Solarize': 'Solarize',
      'ADBE Mosaic': 'Mosaic',
      'ADBE Posterize': 'Posterize',
      'ADBE Threshold2': 'Threshold',
      'ADBE Alpha Levels': 'Alpha Levels',
      'ADBE Brush Strokes': 'Brush Strokes',
      'ADBE Color Emboss': 'Color Emboss',
      'ADBE Glowing Edges': 'Glowing Edges',
      'ADBE Texture': 'Texturize',

      // Distort
      'ADBE Transform': 'Transform',
      'ADBE Warp': 'Warp',
      'ADBE Turbulent Displace': 'Turbulent Displace',
      'ADBE Twirl': 'Twirl',
      'ADBE Ripple': 'Ripple',
      'ADBE Wave Warp': 'Wave Warp',
      'ADBE Spherize': 'Spherize',
      'ADBE Bulge': 'Bulge',
      'ADBE Polar Coordinates': 'Polar Coordinates',
      'ADBE Optics Compensation': 'Optics Compensation',
      'ADBE Liquify': 'Liquify',
      'ADBE Mesh Warp': 'Mesh Warp',
      'ADBE Mirror': 'Mirror',
      'ADBE Offset': 'Offset',
      'ADBE Reshape': 'Reshape',
      'ADBE Smear': 'Smear',
      'ADBE Corner Pin': 'Corner Pin',
      'ADBE Bezier Warp': 'Bezier Warp',

      // Generate
      'ADBE Fill': 'Fill',
      'ADBE Ramp': 'Ramp',
      'ADBE 4 Color Gradient': '4-Color Gradient',
      'ADBE Fractal Noise': 'Fractal Noise',
      'ADBE Turbulent Noise': 'Turbulent Noise',
      'ADBE Cell Pattern': 'Cell Pattern',
      'ADBE Checkerboard': 'Checkerboard',
      'ADBE Circle': 'Circle',
      'ADBE Ellipse': 'Ellipse',
      'ADBE Beam': 'Beam',
      'ADBE Lightning': 'Advanced Lightning',
      'ADBE Vegas': 'Vegas',
      'ADBE Write-on': 'Write-on',
      'ADBE Lens Flare': 'Lens Flare',
      'ADBE Grid': 'Grid',
      'ADBE Paint Bucket': 'Paint Bucket',
      'ADBE Radio Waves': 'Radio Waves',
      'ADBE Scribble': 'Scribble',
      'ADBE Spiral': 'Spiral',

      // Time
      'ADBE Echo': 'Echo',
      'ADBE Timewarp': 'Timewarp',
      'ADBE Time Difference': 'Time Difference',
      'ADBE Posterize Time': 'Posterize Time',
      'ADBE CC Time Blend': 'CC Time Blend',
      'ADBE CC Time Blend FX': 'CC Time Blend FX',
      'ADBE Pixel Motion Blur': 'Pixel Motion Blur',
      'ADBE RSMB': 'ReelSmart Motion Blur',

      // Transition
      'ADBE Block Dissolve': 'Block Dissolve',
      'ADBE Card Wipe': 'Card Wipe',
      'ADBE Gradient Wipe': 'Gradient Wipe',
      'ADBE Iris Wipe': 'Iris Wipe',
      'ADBE Linear Wipe': 'Linear Wipe',
      'ADBE Radial Wipe': 'Radial Wipe',
      'ADBE Venetian Blinds': 'Venetian Blinds',

      // Matte
      'ADBE Simple Choker': 'Simple Choker',
      'ADBE Matte Choker': 'Matte Choker',
      'ADBE Extract': 'Extract',
      'ADBE Linear Color Key': 'Linear Color Key',
      'ADBE Color Key': 'Color Key',
      'ADBE Luma Key': 'Luma Key',
      'ADBE Difference Matte': 'Difference Matte',
      'ADBE Color Difference Key': 'Color Difference Key',
      'ADBE Spill Suppressor': 'Spill Suppressor',
      'ADBE Inner/Outer Key': 'Inner/Outer Key',

      // Audio
      'ADBE Backwards': 'Backwards',
      'ADBE Bass&Treble': 'Bass & Treble',
      'ADBE Delay': 'Delay',
      'ADBE Flange&Chorus': 'Flange & Chorus',
      'ADBE HighLowPass': 'High-Low Pass',
      'ADBE Modulator': 'Modulator',
      'ADBE Parametric EQ': 'Parametric EQ',
      'ADBE Reverb': 'Reverb',
      'ADBE Stereo Mixer': 'Stereo Mixer',
      'ADBE Tone': 'Tone',

      // Channel
      'ADBE Arithmetic': 'Arithmetic',
      'ADBE Blend': 'Blend',
      'ADBE Calculations': 'Calculations',
      'ADBE Channel Combiner': 'Channel Combiner',
      'ADBE Compound Arithmetic': 'Compound Arithmetic',
      'ADBE Invert': 'Invert',
      'ADBE Maximum': 'Maximum',
      'ADBE Minimum': 'Minimum',
      'ADBE Remove Color Matting': 'Remove Color Matting',
      'ADBE Set Channels': 'Set Channels',
      'ADBE Shift Channels': 'Shift Channels',
      'ADBE Set Matte': 'Set Matte',

      // Utility
      'ADBE Grow Bounds': 'Grow Bounds',
      'ADBE Path Text': 'Path Text',
      'ADBE Numbers': 'Numbers',
      'ADBE Slider Control': 'Slider Control',
      'ADBE Angle Control': 'Angle Control',
      'ADBE Checkbox Control': 'Checkbox Control',
      'ADBE Color Control': 'Color Control',
      'ADBE Point Control': 'Point Control',
      'ADBE Layer Control': 'Layer Control',
      'ADBE Expression Control': 'Expression Control',
      'ADBE 3D Point Control': '3D Point Control',

      // Perspective
      'ADBE 3D Camera Tracker': '3D Camera Tracker',
      'ADBE Basic 3D': 'Basic 3D',
      'ADBE Bevel Alpha': 'Bevel Alpha',
      'ADBE Bevel Edges': 'Bevel Edges',
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

    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

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

    // Clean up any double spaces and trim
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    return cleaned || matchName; // Fallback to original if something went wrong
  }

  // Initialize the script
  init();
})(this);
