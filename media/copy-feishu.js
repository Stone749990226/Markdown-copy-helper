(function () {
  "use strict";

  var SCRIPT_KEY = "__markdownCopyHelper";
  var previousScript = window[SCRIPT_KEY];

  if (previousScript && typeof previousScript.dispose === "function") {
    previousScript.dispose();
  }

  var restoreTimer = null;
  var styleChanges = [];
  var alignmentChanges = [];
  var formulaChanges = [];

  function restore() {
    if (restoreTimer !== null) {
      clearTimeout(restoreTimer);
      restoreTimer = null;
    }

    for (var i = formulaChanges.length - 1; i >= 0; i -= 1) {
      var formulaChange = formulaChanges[i];
      if (formulaChange.placeholder.parentNode) {
        formulaChange.placeholder.parentNode.replaceChild(
          formulaChange.formula,
          formulaChange.placeholder
        );
      }
    }
    formulaChanges = [];

    for (var j = styleChanges.length - 1; j >= 0; j -= 1) {
      var styleChange = styleChanges[j];
      if (styleChange.color === "") {
        styleChange.element.style.removeProperty("color");
      } else {
        styleChange.element.style.setProperty(
          "color",
          styleChange.color,
          styleChange.colorPriority
        );
      }

      if (styleChange.fill === "") {
        styleChange.element.style.removeProperty("-webkit-text-fill-color");
      } else {
        styleChange.element.style.setProperty(
          "-webkit-text-fill-color",
          styleChange.fill,
          styleChange.fillPriority
        );
      }
    }
    styleChanges = [];

    for (var k = alignmentChanges.length - 1; k >= 0; k -= 1) {
      var alignmentChange = alignmentChanges[k];
      if (alignmentChange.value === "") {
        alignmentChange.element.style.removeProperty("text-align");
      } else {
        alignmentChange.element.style.setProperty(
          "text-align",
          alignmentChange.value,
          alignmentChange.priority
        );
      }
    }
    alignmentChanges = [];
  }

  function intersectsSelection(element, range) {
    try {
      return range.intersectsNode(element);
    } catch (_error) {
      return false;
    }
  }

  function hasFormulaAncestor(element) {
    var parent = element.parentElement;
    while (parent) {
      if (
        parent.classList.contains("katex-display") ||
        parent.classList.contains("MathJax_Display") ||
        parent.nodeName.toLowerCase() === "mjx-container"
      ) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  function isDisplayFormula(element) {
    if (
      element.classList.contains("katex-display") ||
      element.classList.contains("MathJax_Display") ||
      element.getAttribute("display") === "true"
    ) {
      return true;
    }

    var parent = element.parentElement;
    while (parent) {
      if (
        parent.classList.contains("katex-display") ||
        parent.classList.contains("MathJax_Display") ||
        parent.getAttribute("display") === "true"
      ) {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  }

  function formulaSource(element) {
    var attributeNames = ["data-tex", "data-latex", "alttext"];
    for (var i = 0; i < attributeNames.length; i += 1) {
      var attributeValue = element.getAttribute(attributeNames[i]);
      if (attributeValue) {
        return attributeValue;
      }
    }

    var annotation = element.querySelector(
      "annotation[encoding='application/x-tex'], " +
        "annotation[encoding='application/x-latex'], " +
        "annotation[encoding='application/tex']"
    );
    if (!annotation) {
      annotation = element.querySelector("annotation");
    }
    if (annotation && annotation.textContent) {
      return annotation.textContent;
    }

    var sourceScript = element.querySelector("script[type^='math/tex']");
    return sourceScript ? sourceScript.textContent : "";
  }

  function removeMathDelimiters(source) {
    var value = source.trim();

    if (value.length >= 4 && value.slice(0, 2) === "$$" && value.slice(-2) === "$$") {
      return value.slice(2, -2).trim();
    }
    if (value.length >= 4 && value.slice(0, 2) === "\\[" && value.slice(-2) === "\\]") {
      return value.slice(2, -2).trim();
    }
    if (value.length >= 4 && value.slice(0, 2) === "\\(" && value.slice(-2) === "\\)") {
      return value.slice(2, -2).trim();
    }
    if (
      value.length >= 2 &&
      value.charAt(0) === "$" &&
      value.charAt(value.length - 1) === "$"
    ) {
      return value.slice(1, -1).trim();
    }
    return value;
  }

  function selectedFormulas() {
    var selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return [];
    }

    var range = selection.getRangeAt(0);
    var formulas = [];
    var displaySelector = ".katex-display, .MathJax_Display";
    var displayNodes = document.querySelectorAll(displaySelector);

    for (var i = 0; i < displayNodes.length; i += 1) {
      if (intersectsSelection(displayNodes[i], range)) {
        formulas.push(displayNodes[i]);
      }
    }

    var mathNodes = document.querySelectorAll(".katex, mjx-container, .MathJax");
    for (var j = 0; j < mathNodes.length; j += 1) {
      var mathNode = mathNodes[j];
      if (!hasFormulaAncestor(mathNode) && intersectsSelection(mathNode, range)) {
        formulas.push(mathNode);
      }
    }

    return formulas;
  }

  function replaceSelectedFormulas() {
    var formulas = selectedFormulas();

    for (var i = 0; i < formulas.length; i += 1) {
      var formula = formulas[i];
      var source = removeMathDelimiters(formulaSource(formula));

      if (!source || !formula.parentNode) {
        continue;
      }

      var display = isDisplayFormula(formula);
      var placeholder = document.createElement("span");
      placeholder.setAttribute("data-markdown-copy-feishu-formula", display ? "block" : "inline");
      placeholder.textContent = display ? "$$" + source + "$$" : "$" + source + "$";

      if (display) {
        placeholder.style.setProperty("display", "block");
        placeholder.style.setProperty("text-align", "center");
      }

      formula.parentNode.replaceChild(placeholder, formula);
      formulaChanges.push({ formula: formula, placeholder: placeholder });
    }
  }

  function forceBlackForCopy() {
    if (!document.body) {
      return;
    }

    var elements = [document.body].concat(
      Array.prototype.slice.call(document.body.querySelectorAll("*"))
    );

    for (var i = 0; i < elements.length; i += 1) {
      var element = elements[i];
      if (!element.style) {
        continue;
      }

      styleChanges.push({
        element: element,
        color: element.style.getPropertyValue("color"),
        colorPriority: element.style.getPropertyPriority("color"),
        fill: element.style.getPropertyValue("-webkit-text-fill-color"),
        fillPriority: element.style.getPropertyPriority("-webkit-text-fill-color")
      });

      element.style.setProperty("color", "#000000", "important");
      element.style.setProperty("-webkit-text-fill-color", "#000000", "important");
    }
  }

  function materializeAlignmentForCopy() {
    var selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    var range = selection.getRangeAt(0);
    var alignmentNodes = document.querySelectorAll(
      "p, h1, h2, h3, h4, h5, h6, blockquote, li, td, th, caption, " +
        "div, figure, figcaption, section, article, header, footer"
    );

    for (var i = 0; i < alignmentNodes.length; i += 1) {
      var element = alignmentNodes[i];
      if (!intersectsSelection(element, range)) {
        continue;
      }

      var alignment = window.getComputedStyle(element).textAlign;
      if (
        alignment !== "left" &&
        alignment !== "right" &&
        alignment !== "center" &&
        alignment !== "justify"
      ) {
        continue;
      }

      alignmentChanges.push({
        element: element,
        value: element.style.getPropertyValue("text-align"),
        priority: element.style.getPropertyPriority("text-align")
      });
      element.style.setProperty("text-align", alignment);
    }
  }

  function prepareCopy() {
    restore();
    replaceSelectedFormulas();
    materializeAlignmentForCopy();
    forceBlackForCopy();

    restoreTimer = window.setTimeout(restore, 0);
  }

  document.addEventListener("copy", prepareCopy, true);
  window[SCRIPT_KEY] = {
    dispose: function () {
      document.removeEventListener("copy", prepareCopy, true);
      restore();
    }
  };
})();
