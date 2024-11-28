
#feature-id DonutRepair : ChickadeeScripts > DonutRepair
#feature-info This script repairs circular dust donuts.

// Main Script

/******************************************************************************
 *
 * Dust Donut Repair
 * Version: V1.0
 * Author: Chick Dee
 * Website: https://github.com/chickadeebird
 *
 * This script is designed for repairing circular dust donuts. Adapted from Franklin Marek's Freehand Adaptive Mask Editor
 *
 * This work is licensed under a Creative Commons Attribution-NonCommercial 4.0 International License.
 * To view a copy of this license, visit http://creativecommons.org/licenses/by-nc/4.0/
 *
 * You are free to:
 * 1. Share — copy and redistribute the material in any medium or format
 * 2. Adapt — remix, transform, and build upon the material
 *
 * Under the following terms:
 * 1. Attribution — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
 * 2. NonCommercial — You may not use the material for commercial purposes.
 *
 * @license CC BY-NC 4.0 (http://creativecommons.org/licenses/by-nc/4.0/)
 *
 * COPYRIGHT © 2024 Chick Dee. ALL RIGHTS RESERVED.
 ******************************************************************************/

#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/ImageOp.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/UndoFlag.jsh>

#define TITLE "Dust Donut Repair"
#define VERSION "V1.0"

let parameters = {
    targetWindow: null,
    previewZoomLevel: "Fit to Preview",
    shapes: [],
    shapeTypes: [], // Store types of shapes
    save: function() {
        Parameters.set("shapes", JSON.stringify(this.shapes));
        Parameters.set("shapeTypes", JSON.stringify(this.shapeTypes));
        Parameters.set("previewZoomLevel", this.previewZoomLevel);
        if (this.targetWindow) {
            Parameters.set("targetWindow", this.targetWindow.mainView.id);
        }
    },
    load: function() {
        if (Parameters.has("shapes")) {
            this.shapes = JSON.parse(Parameters.getString("shapes"));
        }
        if (Parameters.has("shapeTypes")) {
            this.shapeTypes = JSON.parse(Parameters.getString("shapeTypes"));
        }
        if (Parameters.has("previewZoomLevel")) {
            this.previewZoomLevel = Parameters.getString("previewZoomLevel");
        }
        if (Parameters.has("targetWindow")) {
            let windowId = Parameters.getString("targetWindow");
            let window = ImageWindow.windowById(windowId);
            if (window && !window.isNull) {
                this.targetWindow = window;
            }
        }
    }
};

function ScrollControl(parent) {
    this.__base__ = ScrollBox;
    this.__base__(parent);

    this.autoScroll = true;
    this.tracking = true;

    this.displayImage = null;
    this.dragging = false;
    this.dragOrigin = new Point(0);
    this.isDrawing = false; // Flag for detecting drawing
    this.isTransforming = false; // Flag for detecting transforming (rotate + resize)
    this.currentShape = [];
    this.shapes = [];
    this.shapeTypes = []; // Track types of shapes
    this.activeShapeIndex = 0; // Initialize activeShapeIndex
    this.scrollPosition = new Point(0, 0); // Ensure scrollPosition is always defined
    this.previousZoomLevel = 1;
    this.shapeType = "Freehand"; // Default shape type
    this.transformCenter = null; // Center point for transformations
    this.initialDistance = null; // Initial distance for resizing
    this.initialAngle = null; // Initial angle for rotating

    this.brushRadius = 10; // Default brush radius
    this.sprayDensity = 0.5; // Default spray density
    this.viewport.cursor = new Cursor(StdCursor_Cross);

    this.zoomFactor = 1;
    this.minZoomFactor = 0.1; // Set the minimum zoom factor for zooming out
    this.maxZoomFactor = 10;  // Set the maximum zoom factor for zooming in

    this.getImage = function() {
        return this.displayImage;
    };

    this.doUpdateImage = function(image) {
        this.displayImage = image;
        this.initScrollBars();
        if (this.viewport) {
            this.viewport.update();
        }
    };

this.initScrollBars = function(scrollPoint = null) {
    var image = this.getImage();
    if (image == null || image.width <= 0 || image.height <= 0) {
        this.setHorizontalScrollRange(0, 0);
        this.setVerticalScrollRange(0, 0);
        this.scrollPosition = new Point(0, 0);
    } else {
        let zoomFactor = this.zoomFactor;
        this.setHorizontalScrollRange(0, Math.max(0, (image.width * zoomFactor)));
        this.setVerticalScrollRange(0, Math.max(0, (image.height * zoomFactor)));
        if (scrollPoint) {
            this.scrollPosition = scrollPoint;
        } else {
            this.scrollPosition = new Point(
                Math.min(this.scrollPosition.x, (image.width * zoomFactor)),
                Math.min(this.scrollPosition.y, (image.height * zoomFactor))
            );
        }
    }
    if (this.viewport) {
        this.viewport.update();
    }
};



    this.calculateTransformCenter = function(shape) {
        let sumX = 0;
        let sumY = 0;
        shape.forEach(point => {
            sumX += point[0];
            sumY += point[1];
        });
        return [sumX / shape.length, sumY / shape.length];
    };

    this.calculateDistance = function(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    };

    this.calculateAngle = function(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1);
    };

    this.transformShape = function(shape, angle, scaleX, scaleY, centerX, centerY) {
        return shape.map(point => {
            let translatedX = point[0] - centerX;
            let translatedY = point[1] - centerY;
            let rotatedX = translatedX * Math.cos(angle) - translatedY * Math.sin(angle);
            let rotatedY = translatedX * Math.sin(angle) + translatedY * Math.cos(angle);
            let resizedX = rotatedX * scaleX;
            let resizedY = rotatedY * scaleY;
            return [resizedX + centerX, resizedY + centerY];
        });
    };

this.viewport.onMousePress = function(x, y, button, buttons, modifiers) {
    var parent = this.parent; // Store reference to parent
    let zoomFactor = parent.zoomFactor;
    let adjustedX = (x / zoomFactor) + parent.scrollPosition.x;
    let adjustedY = (y / zoomFactor) + parent.scrollPosition.y;

    if (modifiers === 1) { // Shift key detection
        parent.startX = adjustedX;
        parent.startY = adjustedY;
        parent.isDrawing = true;
        parent.dragging = false; // Prevent scrolling while drawing

        // Handle different shape types
        if (parent.shapeType === "Ellipse" || parent.shapeType === "Rectangle") {
            parent.currentShape = [[parent.startX, parent.startY], [parent.startX, parent.startY]];
        } else if (parent.shapeType === "SprayCan") {
            parent.currentShape = []; // Initialize currentShape for spray can
        } else if (parent.shapeType === "Brush") {
            parent.currentShape = []; // Initialize currentShape for brush strokes
        }
    } else if (modifiers === 2) { // Ctrl key detection
        parent.startX = adjustedX;
        parent.startY = adjustedY;
        parent.isMoving = true;
        parent.dragging = false; // Prevent scrolling while moving

        // Save original shape
        parent.originalShape = [];
        for (let i = 0; i < parent.shapes[parent.activeShapeIndex].length; i++) {
            parent.originalShape.push(parent.shapes[parent.activeShapeIndex][i].slice());
        }
    } else if (modifiers === 4) { // Alt key detection
        parent.startX = adjustedX;
        parent.startY = adjustedY;
        parent.isTransforming = true;
        parent.transformCenter = parent.calculateTransformCenter(parent.shapes[parent.activeShapeIndex]);
        parent.initialAngle = parent.calculateAngle(parent.transformCenter[0], parent.transformCenter[1], parent.startX, parent.startY);
        parent.initialDistance = parent.calculateDistance(parent.startX, parent.startY, parent.transformCenter[0], parent.transformCenter[1]);

        // Save original shape
        parent.originalShape = [];
        for (let i = 0; i < parent.shapes[parent.activeShapeIndex].length; i++) {
            parent.originalShape.push(parent.shapes[parent.activeShapeIndex][i].slice());
        }
    } else {
        this.cursor = new Cursor(StdCursor_ClosedHand);
        parent.dragOrigin.x = x;
        parent.dragOrigin.y = y;
        parent.dragging = true;
    }
};


this.viewport.onMouseMove = function(x, y, buttons, modifiers) {
    var parent = this.parent; // Store reference to parent
    let zoomFactor = parent.zoomFactor;
    let adjustedX = (x / zoomFactor) + parent.scrollPosition.x;
    let adjustedY = (y / zoomFactor) + parent.scrollPosition.y;

    if (!parent) return;
    if (parent.isDrawing) {
        let endX = adjustedX;
        let endY = adjustedY;
        
        let centerX = (parent.startX + endX) / 2;
        let centerY = (parent.startY + endY) / 2;
        let radiusX = Math.abs(endX - parent.startX) / 2;
        let radiusY = Math.abs(endY - parent.startY) / 2;
        parent.currentShape = [];
        for (let angle = 0; angle < 2 * Math.PI; angle += 0.01) {
                parent.currentShape.push([
                    centerX + radiusX * Math.cos(angle),
                    centerY + radiusY * Math.sin(angle)
                ]);
        }
        parent.currentShape.push(parent.currentShape[0]); // Close the shape
        
        if (parent.viewport) {
            parent.viewport.update();
        }
    } else if (parent.isMoving) {
        let dx = adjustedX - parent.startX;
        let dy = adjustedY - parent.startY;
        parent.shapes[parent.activeShapeIndex] = parent.originalShape.map(point => [point[0] + dx, point[1] + dy]);
        if (parent.viewport) {
            parent.viewport.update();
        }
    } else if (parent.isTransforming) {
        let currentAngle = parent.calculateAngle(parent.transformCenter[0], parent.transformCenter[1], adjustedX, adjustedY);
        let angleDifference = currentAngle - parent.initialAngle;
        let currentDistance = parent.calculateDistance(adjustedX, adjustedY, parent.transformCenter[0], parent.transformCenter[1]);
        let scale = currentDistance / parent.initialDistance;
        parent.shapes[parent.activeShapeIndex] = parent.transformShape(parent.originalShape, angleDifference, scale, scale, parent.transformCenter[0], parent.transformCenter[1]);
        if (parent.viewport) {
            parent.viewport.update();
        }
    } else if (parent.dragging) {
        let dx = (parent.dragOrigin.x - x) / zoomFactor;
        let dy = (parent.dragOrigin.y - y) / zoomFactor;
        parent.scrollPosition = new Point(parent.scrollPosition.x + dx, parent.scrollPosition.y + dy);
        parent.dragOrigin.x = x;
        parent.dragOrigin.y = y;
        if (parent.viewport) {
            parent.viewport.update();
        }
    }
};


this.viewport.onMouseRelease = function(x, y, button, buttons, modifiers) {
    var parent = this.parent; // Store reference to parent
    let zoomFactor = parent.zoomFactor;
    let adjustedX = (x / zoomFactor) + parent.scrollPosition.x;
    let adjustedY = (y / zoomFactor) + parent.scrollPosition.y;

    if (!parent) return;
    if (parent.isDrawing) {
        parent.isDrawing = false;

        if (parent.shapes.length > 0) {
            // apparently this is the fastest way to empty a list(?)
            Console.writeln("Emptying existing shapes list");
            parent.shapes.length = 0;
            Console.writeln("Shapes list emptied");
        }

        // Finalize the shape and ensure no extraneous points are added
        parent.shapes.push(parent.currentShape.filter(point => !isNaN(point[0]) && !isNaN(point[1])));
        parent.shapeTypes.push(parent.shapeType); // Save the shape type
        parent.currentShape = [];
        parent.activeShapeIndex = parent.shapes.length - 1; // Set the newly drawn shape as the active shape
        if (parent.viewport) {
            parent.viewport.update();
        }
    } else if (parent.isMoving) {
        parent.isMoving = false;
        if (parent.viewport) {
            parent.viewport.update();
        }
    } else if (parent.isTransforming) {
        parent.isTransforming = false;
        if (parent.viewport) {
            parent.viewport.update();
        }
    } else {
        this.cursor = new Cursor(StdCursor_Cross);
        parent.dragging = false;
    }
};


this.viewport.onMouseWheel = function(x, y, delta, buttons, modifiers) {
    var parent = this.parent; // Store reference to parent

    if (!parent.displayImage) {
        console.error("No display image set.");
        return;
    }

    let oldZoomFactor = parent.zoomFactor;

    // Calculate the old scroll position percentage
    let maxHorizontalScroll = (parent.displayImage.width * oldZoomFactor) - parent.viewport.width;
    let maxVerticalScroll = (parent.displayImage.height * oldZoomFactor) - parent.viewport.height;
    let oldScrollPercentageX = parent.scrollPosition.x / maxHorizontalScroll;
    let oldScrollPercentageY = parent.scrollPosition.y / maxVerticalScroll;

    // Update the zoom factor based on the wheel delta
    if (delta > 0) {
        parent.zoomFactor = Math.min(parent.zoomFactor * 1.25, parent.maxZoomFactor);
    } else if (delta < 0) {
        parent.zoomFactor = Math.max(parent.zoomFactor * 0.8, parent.minZoomFactor);
    }
    let newZoomFactor = parent.zoomFactor;

    // Reinitialize scrollbars to reflect the new zoom level
    parent.initScrollBars();

    // Calculate the new scroll position using the old scroll percentage
    maxHorizontalScroll = (parent.displayImage.width * newZoomFactor) - parent.viewport.width;
    maxVerticalScroll = (parent.displayImage.height * newZoomFactor) - parent.viewport.height;
    let newScrollPositionX = oldScrollPercentageX * maxHorizontalScroll;
    let newScrollPositionY = oldScrollPercentageY * maxVerticalScroll;

    // Ensure the new scroll position stays within valid bounds
    newScrollPositionX = Math.max(0, Math.min(newScrollPositionX, maxHorizontalScroll));
    newScrollPositionY = Math.max(0, Math.min(newScrollPositionY, maxVerticalScroll));

    // Update the scroll position to keep the same relative position
    parent.scrollPosition = new Point(newScrollPositionX, newScrollPositionY);

    parent.viewport.update();
};


// Updated onPaint
this.viewport.onPaint = function(x0, y0, x1, y1) {
    var g = new Graphics(this);
    var result = this.parent.getImage();
    let zoomFactor = this.parent.zoomFactor;

    if (result == null) {
        g.fillRect(x0, y0, x1, y1, new Brush(0xff000000));
    } else {
        // Apply the scaling transformation
        g.scaleTransformation(zoomFactor);

        // Translate the image to account for scrolling
        g.translateTransformation(-this.parent.scrollPosition.x, -this.parent.scrollPosition.y);

        // Draw the image
        g.drawBitmap(0, 0, result.render());

        // Draw the user-defined shapes if they exist
        this.parent.shapes.forEach((shape, index) => {
            g.pen = new Pen(index === this.parent.activeShapeIndex ? 0xff00ff00 : 0xffff0000);
            
            for (let i = 0; i < shape.length - 1; i++) {
                if (Number.isFinite(shape[i][0]) && Number.isFinite(shape[i][1]) && Number.isFinite(shape[i + 1][0]) && Number.isFinite(shape[i + 1][1])) {
                    g.drawLine(shape[i][0], shape[i][1],
                        shape[i + 1][0], shape[i + 1][1]);
                }
            }
        });
        
        // Draw the current shape if it exists
        if (this.parent.currentShape.length > 0) {
            g.pen = new Pen(0xff00ff00);
            
            for (let i = 0; i < this.parent.currentShape.length - 1; i++) {
                if (Number.isFinite(this.parent.currentShape[i][0]) && Number.isFinite(this.parent.currentShape[i][1]) && Number.isFinite(this.parent.currentShape[i + 1][0]) && Number.isFinite(this.parent.currentShape[i + 1][1])) {
                    g.drawLine(this.parent.currentShape[i][0], this.parent.currentShape[i][1],
                        this.parent.currentShape[i + 1][0], this.parent.currentShape[i + 1][1]);
                }
            }
        }
    }

    g.end();
    gc();
};





    this.setFocus = function() {
        this.viewport.onKeyPress = (keyCode, modifiers) => {
            if (keyCode === 0x20) { // Spacebar key
                this.activeShapeIndex = (this.activeShapeIndex + 1) % this.shapes.length;
                this.viewport.update();
            }
        };
    };

    this.initScrollBars();
}
ScrollControl.prototype = new ScrollBox;


// Function to scale all shapes when zoom changes
ScrollControl.prototype.scaleShapes = function(newZoomLevel) {
    try {
        let scaleRatio = this.previousZoomLevel / newZoomLevel;
        this.shapes = this.shapes.map((shape, index) => {
            if (this.shapeTypes[index] === "SprayCan") {
                return this.scaleSprayCanPoints(shape, scaleRatio);
            } else if (this.shapeTypes[index] === "Brush") {
                return this.scaleBrushPoints(shape, scaleRatio);
            } else {
                return shape.map(point => [
                    Math.round(point[0] * scaleRatio),
                    Math.round(point[1] * scaleRatio)
                ]);
            }
        });
        this.previousZoomLevel = newZoomLevel;
        if (this.viewport) {
            this.viewport.update();
        }
    } catch (error) {
        // Suppress any warnings or errors
        console.warningln("Error during shape scaling: " + error);
    }
};

// Ensure this function is called whenever the zoom level changes
DustDonutDialog.prototype.updateZoomLevel = function(newZoomLevel) {
    if (this.previewControl) {
        this.previewControl.scaleShapes(newZoomLevel);
    }
};


function DustDonutDialog() {
    this.__base__ = Dialog;
    this.__base__();

    this.title_Lbl = new Label(this);
    this.title_Lbl.frameStyle = FrameStyle_Box;
    this.title_Lbl.margin = 6;
    this.title_Lbl.useRichText = true;
    this.title_Lbl.text = "<b>Dust Donut Repair " + VERSION + "</b>";
    this.title_Lbl.textAlignment = TextAlign_Center;

    this.instructions_Lbl = new TextBox(this);
    this.instructions_Lbl.readOnly = true;
    this.instructions_Lbl.frameStyle = FrameStyle_Box;
    this.instructions_Lbl.text = "Instructions:\n\nShift + Click and drag to draw an ellipse.\n\nCTRL+Click and Drag to MOVE the drawn shape.\nALT+Click and Drag to ROTATE and RESIZE\n\nGrey undo button removes the active shape\nRed Reset Button removes the ellipse.";
    this.instructions_Lbl.setScaledMinWidth(450); // Set a fixed width for the instructions

    let currentWindowName = ImageWindow.activeWindow.mainView.id;
    this.imageLabel = new Label(this);
    this.imageLabel.text = "Select Image:";
    this.imageLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

    this.windowSelector_Cb = new ComboBox(this);
    this.windowSelector_Cb.toolTip = "Select the window you want to use.";
    for (var i = 0; i < ImageWindow.windows.length; i++) {
        this.windowSelector_Cb.addItem(ImageWindow.windows[i].mainView.id);
        if (ImageWindow.windows[i].mainView.id == currentWindowName) {
            this.windowSelector_Cb.currentItem = i;
            let window = ImageWindow.windowById(currentWindowName);
            if (window && !window.isNull) {
                parameters.targetWindow = window;
            }
        }
    }

    this.windowSelector_Cb.onItemSelected = (index) => {
        if (index >= 0) {
            let window = ImageWindow.windowById(this.windowSelector_Cb.itemText(index));
            if (window && !window.isNull) {
                parameters.targetWindow = window;
                let selectedImage = window.mainView.image;
                if (selectedImage) {
                    console.writeln("Displaying the selected image in the preview.");
                    var tmpImage = this.createAndDisplayTemporaryImage(selectedImage);
                    this.previewControl.displayImage = tmpImage;
                    this.previewControl.initScrollBars();
                    this.previewControl.viewport.update();
                    // Set the previous zoom level to the initial downsampling factor
                    this.previousZoomLevel = this.downsamplingFactor;
                } else {
                    console.error("Selected image is undefined.");
                }
            } else {
                console.writeln("No valid window selected for preview!");
                this.previewControl.visible = false;
                this.zoomSizer.visible = false;
                this.adjustToContents();
            }
        }
    };

    // 
    this.imageSelectionSizer = new HorizontalSizer;
    this.imageSelectionSizer.spacing = 4;
    this.imageSelectionSizer.add(this.imageLabel); // Add the label to the sizer
    this.imageSelectionSizer.add(this.windowSelector_Cb, 1);

    this.shapeType = "Ellipse"; // Default shape type
    

  
    // Add the AutoSTF checkbox
    this.autoSTF_Cb = new CheckBox(this);
    this.autoSTF_Cb.text = "AutoSTF";
    this.autoSTF_Cb.checked = true; // Default to unchecked
    this.autoSTF_Cb.onCheck = () => {
        if (parameters.targetWindow) {
            var selectedImage = parameters.targetWindow.mainView.image;
            if (selectedImage) {
                let tmpImage = this.createAndDisplayTemporaryImage(selectedImage);
                this.previewControl.displayImage = tmpImage;
                this.previewControl.viewport.update();
            }
        }
    };

    this.zoomLabel = new Label(this);
    this.zoomLabel.text = "Preview Zoom Level: ";
    this.zoomLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

    this.zoomLevelComboBox = new ComboBox(this);
    this.zoomLevelComboBox.addItem("1:1");
    this.zoomLevelComboBox.addItem("1:2");
    this.zoomLevelComboBox.addItem("1:4");
    this.zoomLevelComboBox.addItem("1:8");
    this.zoomLevelComboBox.addItem("Fit to Preview");
    this.zoomLevelComboBox.currentItem = 1;

    // Add a variable to store the previous zoom level
    this.previousZoomLevel = this.zoomLevelComboBox.currentItem;

    this.zoomLevelComboBox.onItemSelected = (index) => {
        if (parameters.targetWindow) {
            var selectedImage = parameters.targetWindow.mainView.image;
            if (selectedImage) {
                console.writeln("Adjusting preview for image with ID: " + parameters.targetWindow.mainView.id);
                let tmpImage = this.createAndDisplayTemporaryImage(selectedImage);
                this.previewControl.displayImage = tmpImage;
                this.previewControl.viewport.update();

                // Scale shapes according to the new zoom level
                let newZoomLevel = this.downsamplingFactor;
                this.scaleShapes(newZoomLevel);
            } else {
                console.error("Selected image is undefined.");
            }
        } else {
            console.writeln("No image selected for preview!");
        }
    };

    this.resetButton = new ToolButton(this);
    this.resetButton.icon = this.scaledResource(":/icons/execute.png"); // Updated to use the red lightning bolt icon
    this.resetButton.toolTip = "Reset selections";
    this.resetButton.onMousePress = () => {
        this.previewControl.shapes = [];
        this.previewControl.viewport.update();
    };

    this.undoButton = new ToolButton(this);
    this.undoButton.icon = this.scaledResource(":/icons/reload.png"); // Updated to use the grey icon for undo
    this.undoButton.toolTip = "Undo last shape";
    this.undoButton.onMousePress = () => {
        if (this.previewControl.shapes.length > 0) {
            // Remove the active shape
            this.previewControl.shapes.splice(this.previewControl.activeShapeIndex, 1);

            // Adjust activeShapeIndex
            if (this.previewControl.shapes.length === 0) {
                this.previewControl.activeShapeIndex = 0; // Reset to 0 if no shapes are left
            } else {
                this.previewControl.activeShapeIndex = this.previewControl.activeShapeIndex % this.previewControl.shapes.length;
            }

            this.previewControl.viewport.update();
        }
    };

    // Update this section to include the AutoSTF checkbox in the zoomSizer
    this.zoomSizer = new HorizontalSizer;
    this.zoomSizer.spacing = 4;
    this.zoomSizer.add(this.autoSTF_Cb); // Add the AutoSTF checkbox to the sizer
    this.zoomSizer.add(this.zoomLabel);
    this.zoomSizer.add(this.zoomLevelComboBox);
    this.zoomSizer.add(this.undoButton); // Add the undo button next to the zoom control
    this.zoomSizer.add(this.resetButton); // Add the reset button next to the zoom control

    // Define the label for the authorship information
    this.authorship_Lbl = new Label(this);
    this.authorship_Lbl.frameStyle = FrameStyle_Box;
    this.authorship_Lbl.margin = 6;
    this.authorship_Lbl.useRichText = true;
    this.authorship_Lbl.text = "Written by Chick Dee<br>Website: <a href=\"https://github.com/chickadeebird\">github.com/chickadeebird</a>";
    this.authorship_Lbl.textAlignment = TextAlign_Center;

    this.newInstance_Btn = new ToolButton(this);
    this.newInstance_Btn.icon = this.scaledResource(":/process-interface/new-instance.png");
    this.newInstance_Btn.setScaledFixedSize(24, 24);
    this.newInstance_Btn.toolTip = "Create new instance with the current parameters.";
    this.newInstance_Btn.onMousePress = () => {
        parameters.save();
        this.newInstance();
    };

    this.execute_Btn = new PushButton(this);
    this.execute_Btn.text = "Execute";
    this.execute_Btn.toolTip = "Generate the mask based on the user-defined shapes.";
    // Correcting the execute button's onClick function to use the generateMaskImage method
    this.execute_Btn.onClick = () => {
        console.writeln("Executing the script with the selected parameters.");
        if (parameters.targetWindow) {
            let selectedImage = parameters.targetWindow.mainView.image;
            if (selectedImage) {
                this.repairDustDonut(selectedImage);
            } else {
                console.error("Selected image is undefined.");
            }
        } else {
            console.writeln("No image selected for mask generation!");
        }
    };

    this.buttonSizerHorizontal = new HorizontalSizer;
    this.buttonSizerHorizontal.spacing = 6;
    this.buttonSizerHorizontal.add(this.newInstance_Btn);
    this.buttonSizerHorizontal.addStretch();
    this.buttonSizerHorizontal.add(this.execute_Btn);

    this.previewControl = new ScrollControl(this);
    this.previewControl.setMinWidth(640);
    this.previewControl.setMinHeight(450);

    // Create the label with the desired text
this.zoomInstructionLabel = new Label(this);
this.zoomInstructionLabel.text = "Use the Mouse Wheel to Zoom In and Out";
this.zoomInstructionLabel.textAlignment = TextAlign_Center;

// Create a vertical sizer to hold the label and the previewControl
this.previewSizer = new VerticalSizer;
this.previewSizer.spacing = 4;
this.previewSizer.add(this.zoomInstructionLabel);
this.previewSizer.add(this.previewControl, 1);

    this.mainSizer = new HorizontalSizer;
    this.mainSizer.spacing = 4;

    // Define a spacer control with a fixed width
    this.leftSideSpacer = new Control(this);
    this.leftSideSpacer.setFixedWidth(5); // Adjust the width as needed

    // Insert the spacer control at the beginning of the mainSizer
    this.mainSizer.insert(0, this.leftSideSpacer);
    this.mainSizer.addSpacing(0); // Add some spacing after the spacer

    this.leftSizer = new VerticalSizer;
    this.leftSizer.spacing = 6;
    this.leftSizer.add(this.title_Lbl);
    this.leftSizer.addSpacing(10);
    this.leftSizer.add(this.instructions_Lbl);
    this.leftSizer.addSpacing(10);
    this.leftSizer.add(this.imageSelectionSizer); // Add the image selection sizer
    this.leftSizer.addSpacing(10);
    // this.leftSizer.add(this.shapeSizer); // Add the shape type sizer
    this.leftSizer.addSpacing(10);
    // this.leftSizer.add(this.blurAmount_Slider); // Add the blur amount slider
    this.leftSizer.addSpacing(10);
    // this.leftSizer.add(this.maskTypeSizer);
    // this.leftSizer.add(this.colorMaskSizer);
    this.leftSizer.addSpacing(10);
    this.leftSizer.add(this.zoomSizer);
    this.leftSizer.addSpacing(10);
    this.leftSizer.add(this.authorship_Lbl);
    this.leftSizer.addSpacing(10);
    this.leftSizer.add(this.buttonSizerHorizontal);

// Create a control to fix the width of the left panel
this.leftPanel = new Control(this);
this.leftPanel.sizer = this.leftSizer;
this.leftPanel.setFixedWidth(320); // Adjust this value as needed

// Add the leftSizer and the previewSizer to the mainSizer
this.mainSizer.add(this.leftPanel);
this.mainSizer.add(this.previewSizer);

    this.sizer = this.mainSizer;

    this.windowTitle = "Dust Donut Repair";
    this.adjustToContents();

    // Add key event listener
    this.onKeyDown = function(keyCode, modifiers) {
        if (keyCode === 0x20) { // Spacebar key
            if (this.previewControl.shapes.length > 0) {
                this.previewControl.activeShapeIndex = (this.previewControl.activeShapeIndex + 1) % this.previewControl.shapes.length;
                this.previewControl.viewport.update();
            }
        }
    }.bind(this);

    // Ensure the initial display setup calls the correct function
    this.onShow = () => {
        if (this.windowSelector_Cb.currentItem >= 0) { // Adjust for "Select Image:" item
            let window = ImageWindow.windowById(this.windowSelector_Cb.itemText(this.windowSelector_Cb.currentItem));
            if (window && !window.isNull) {
                let selectedImage = window.mainView.image;
                if (selectedImage) {
                    console.writeln("Displaying the initial image in the preview.");
                    var tmpImage = this.createAndDisplayTemporaryImage(selectedImage);
                    this.previewControl.displayImage = tmpImage;
                    this.previewControl.initScrollBars();
                    this.previewControl.viewport.update();

                    // Set the previous zoom level to the initial downsampling factor
                    this.previousZoomLevel = this.downsamplingFactor;
                }
            }
        } else {
            console.noteln("No image selected for preview.");
            this.previewControl.visible = false;
            this.zoomSizer.visible = false;
            this.adjustToContents(); // Adjust the dialog size to fit the initial content
        }

        this.previewControl.setFocus(); // Set focus to handle key events
    };

    
    // Function to scale shapes according to the new zoom level
    this.scaleShapes = function(newZoomLevel) {
        try {
            let scaleRatio = this.previousZoomLevel / newZoomLevel;
            this.previewControl.shapes = this.previewControl.shapes.map(shape => shape.map(point => [point[0] * scaleRatio, point[1] * scaleRatio]));
            this.previousZoomLevel = newZoomLevel;
            if (this.previewControl.viewport) {
                this.previewControl.viewport.update();
            }
        } catch (error) {
            // Suppress any warnings or errors
        }
    };

    // Function to create, resize, and display a temporary image
    this.createAndDisplayTemporaryImage = function(selectedImage) {
        let window = new ImageWindow(selectedImage.width, selectedImage.height,
            selectedImage.numberOfChannels,
            selectedImage.bitsPerSample,
            selectedImage.isReal,
            selectedImage.isColor
        );

        window.mainView.beginProcess();
        window.mainView.image.assign(selectedImage);
        window.mainView.endProcess();

        if (this.autoSTF_Cb.checked) {
            var P = new PixelMath;
            P.expression =
                "C = -2.8  ;\n" +
                "B = 0.20  ;\n" +
                "c = min(max(0,med($T)+C*1.4826*mdev($T)),1);\n" +
                "mtf(mtf(B,med($T)-c),max(0,($T-c)/~c))";
            P.expression1 = "";
            P.expression2 = "";
            P.expression3 = "";
            P.useSingleExpression = true;
            P.symbols = "C,B,c";
            P.clearImageCacheAndExit = false;
            P.cacheGeneratedImages = false;
            P.generateOutput = true;
            P.singleThreaded = false;
            P.optimization = true;
            P.use64BitWorkingImage = false;
            P.rescale = false;
            P.rescaleLower = 0;
            P.rescaleUpper = 1;
            P.truncate = true;
            P.truncateLower = 0;
            P.truncateUpper = 1;
            P.createNewImage = false;
            P.showNewImage = true;
            P.newImageId = "";
            P.newImageWidth = 0;
            P.newImageHeight = 0;
            P.newImageAlpha = false;
            P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
            P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
            P.executeOn(window.mainView);
        }

        var P = new IntegerResample;
        switch (this.zoomLevelComboBox.currentItem) {
            case 0: // 1:1
                P.zoomFactor = -1;
                this.downsamplingFactor = 1;
                break;
            case 1: // 1:2
                P.zoomFactor = -2;
                this.downsamplingFactor = 2;
                break;
            case 2: // 1:4
                P.zoomFactor = -4;
                this.downsamplingFactor = 4;
                break;
            case 3: // 1:8
                P.zoomFactor = -8;
                this.downsamplingFactor = 8;
                break;
            case 4: // Fit to Preview
                const previewWidth = this.previewControl.width;
                const widthScale = Math.floor(selectedImage.width / previewWidth);
                P.zoomFactor = -Math.max(widthScale, 1);
                this.downsamplingFactor = Math.max(widthScale, 1);
                break;
            default:
                P.zoomFactor = -2; // Default to 1:2 if nothing is selected
                this.downsamplingFactor = 2;
                break;
        }

        P.executeOn(window.mainView);

        let resizedImage = new Image(window.mainView.image);

        if (resizedImage.width > 0 && resizedImage.height > 0) {
            this.previewControl.displayImage = resizedImage;
            this.previewControl.doUpdateImage(resizedImage);
            this.previewControl.initScrollBars();
        } else {
            console.error("Resized image has invalid dimensions.");
        }

        window.forceClose();

        return resizedImage;
    };
}
DustDonutDialog.prototype = new Dialog;

// Update mask generation logic to handle the "Color" mask type
function getColorRange(color) {
    switch (color) {
        case "Red":
            return { min: 330, max: 40 }; // Adjusted to be narrower in the orange region
        case "Yellow":
            return { min: 40, max: 85 }; // Adjusted to be narrower in the red region
        case "Green":
            return { min: 85, max: 160 }; // Kept as is
        case "Cyan":
            return { min: 160, max: 200 }; // Kept as is
        case "Blue":
            return { min: 200, max: 270 }; // Kept as is
        case "Magenta":
            return { min: 270, max: 330 }; // Extended into the purple region
        default:
            return { min: 0, max: 0 }; // Default to no range
    }
}


DustDonutDialog.prototype.repairDustDonut = function (selectedImage) {
    console.noteln("Donut repair initiated");
    console.flush();

    let self = this; // Store reference to 'this'

    // Check if the image is a mono image
    if (selectedImage.numberOfChannels >1) {
        (new MessageBox("Only for mono images.", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create a new grayscale image with the same dimensions as the original image to be used as a temporary mask image
    let maskWindow = new ImageWindow(selectedImage.width, selectedImage.height,
        1, // 1 channel for grayscale
        selectedImage.bitsPerSample,
        selectedImage.isReal,
        false
    );

    let maskImageView = maskWindow.mainView;
    maskImageView.beginProcess(UndoFlag_NoSwapFile);
    let maskImage = maskImageView.image;
    maskImage.fill(0); // Initialize the mask image with black (0)

    // Scale shapes according to the full-size image dimensions
    let scaleRatio = this.downsamplingFactor; // Scale factor from the preview to full-size image

    if (this.previewControl.shapes < 1) {
        (new MessageBox("No donuts selected with a shape.", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }
    
    // Get first shape, which should be an ellipse
    let firstShape = this.previewControl.shapes[0];
    Console.writeln("firstShape found length: " + firstShape.length);
    Console.writeln("firstShape x0: " + firstShape[0][0]);
    Console.writeln("firstShape y0: " + firstShape[0][1]);
    
    // let scaledShape = firstShape.map(point => [point[0] * scaleRatio, point[1] * scaleRatio]);
    // Function to find the minimum and maximum y-coordinates in the polygon
    // function findMinMaxXY(polygon) {
    Console.writeln("In findMinMaxXY");
    let minY = firstShape[0][1];
    let maxY = firstShape[0][1];
    let minX = firstShape[0][0];
    let maxX = firstShape[0][0];
    Console.writeln("minY: " + minY);
    Console.writeln("In findMinMaxXY initial shape boundaries x0: " + minX + " x1: " + maxX + " y0: " + minY + " y1: " + maxY);
    for (let i = 1; i < firstShape.length; i++) {
        if (firstShape[i][1] < minY) minY = firstShape[i][1];
        if (firstShape[i][1] > maxY) maxY = firstShape[i][1];
        if (firstShape[i][0] < minX) minX = firstShape[i][0];
        if (firstShape[i][0] > maxX) maxX = firstShape[i][0];

    }
    // return { minY: minY, maxY: maxY, minX: minX, maxX: maxX };
    // }

    Console.writeln("In findMinMaxXY shape boundaries x0: " + minX + " x1: " + maxX + " y0: " + minY + " y1: " + maxY);

    let x0 = scaleRatio * minX;
    let x1 = scaleRatio * maxX;
    let y0 = scaleRatio * minY;
    let y1 = scaleRatio * maxY;

    Console.writeln("In findMinMaxXY scaled shape boundaries x0: " + x0 + " x1: " + x1 + " y0: " + y0 + " y1: " + y1);


    let xRadius = (x1 - x0) / 2;
    let yRadius = (y1 - y0) / 2;
    let avgRadius = (xRadius + yRadius) / 2;
    let RING_MIN_FACTOR = 1.15;
    let RING_MAX_FACTOR = 1.25;
    let RING_BOUND_FACTOR = 1.4;

    let PM = new PixelMath();
    PM.expression = "iif((inellipse(" + (x0 + x1) / 2 + "," + (y0 + y1) / 2 + "," + xRadius * RING_MAX_FACTOR + "," + yRadius * RING_MAX_FACTOR + ") - inellipse(" + (x0 + x1) / 2 + "," + (y0 + y1) / 2 + "," + xRadius * RING_MIN_FACTOR + "," + yRadius * RING_MIN_FACTOR + "))>0,1,0)";
    Console.writeln("PM expression: " + PM.expression);

    PM.symbols = "a, b, c";
    PM.createNewImage = false;
    PM.newImageId = "";
    Console.writeln("PixelMath expression:" + PM.expression);
    
    PM.executeOn(maskWindow.mainView);

    let lowerBoundX = ((x0 + x1) / 2) - RING_BOUND_FACTOR * xRadius;
    let upperBoundX = ((x0 + x1) / 2) + RING_BOUND_FACTOR * xRadius;
    let lowerBoundY = ((y0 + y1) / 2) - RING_BOUND_FACTOR * yRadius;
    let upperBoundY = ((y0 + y1) / 2) + RING_BOUND_FACTOR * yRadius;

    Console.writeln("Shape boundaries x0: " + lowerBoundX + " x1: " + upperBoundX + " y0: " + lowerBoundY + " y1: " + upperBoundY);

    if (lowerBoundX < 0) lowerBoundX = 0;
    if (lowerBoundY < 0) lowerBoundY = 0;
    if (upperBoundX > maskImage.width) upperBoundX = maskImage.width;
    if (upperBoundY > maskImage.height) upperBoundY = maskImage.height;

    let ringMedianList = [];

    for (let x = lowerBoundX; x < upperBoundX; x++) {
        for (let y = lowerBoundY; y < upperBoundY; y++) {
            if (maskImage.sample(x, y) > 0)
            {
                ringMedianList.push(selectedImage.sample(x, y));
            }
        }
    }

    function medianOfList(arr) {
        // Sort the array in ascending order
        arr.sort((a, b) => a - b);

        const length = arr.length;

        // If the array has an odd length
        if (length % 2 === 1) {
            return arr[Math.floor(length / 2)];
        } else {
            // If the array has an even length
            const mid1 = arr[length / 2 - 1];
            const mid2 = arr[length / 2];
            return (mid1 + mid2) / 2;
        }
    }

    let medianOfRing = medianOfList(ringMedianList);

    Console.writeln("Median of ring: " + medianOfRing);

    maskImage.fill(0);

    let CIRCLE_SCALE_FACTOR = 0.8;

    PM.expression = "inellipse(" + (x0 + x1) / 2 + "," + (y0 + y1) / 2 + "," + xRadius * CIRCLE_SCALE_FACTOR + "," + yRadius * CIRCLE_SCALE_FACTOR + ")";

    PM.executeOn(maskWindow.mainView);

    let circleMedianList = [];

    for (let x = lowerBoundX; x < upperBoundX; x++) {
        for (let y = lowerBoundY; y < upperBoundY; y++) {
            if (maskImage.sample(x, y) > 0) {
                circleMedianList.push(selectedImage.sample(x, y));
            }
        }
    }

    let medianOfCircle = medianOfList(circleMedianList);

    Console.writeln("Median of circle: " + medianOfCircle);

    maskImage.fill(0);

    PM.expression = "inellipse(" + (x0 + x1) / 2 + "," + (y0 + y1) / 2 + "," + xRadius + "," + yRadius + ")";
    PM.executeOn(maskWindow.mainView);

    function create2DGaussianArray(width, height, sigma) {
        const centerX = width / 2;
        const centerY = height / 2;
        const gaussianArray = [];
        const gImage = new Image(width, height);
        gImage.fill(0);

        for (let y = 0; y < height; y++) {
            const row = [];
            for (let x = 0; x < width; x++) {
                const exponent = -1 * (Math.pow((x - centerX), 2) + Math.pow((y - centerY),2)) / (2 * Math.pow(sigma, 2));
                const value = Math.exp(exponent);
                row.push(value);
                gImage.setSample(value, x, y);
            }
            gaussianArray.push(row);
        }

        return gImage;
    }

    let GAUSSIAN_ARRAY_SIZE = 51;

    
    let gaussianImage = new Image;

    Console.writeln("Gaussian image initialized");

    gaussianImage = create2DGaussianArray(GAUSSIAN_ARRAY_SIZE, GAUSSIAN_ARRAY_SIZE, 1);

    
    Console.writeln("Gaussian image created");

    
    function extractSubimage(array2D, startRow, startCol, endRow, endCol) {
        
        const startRowT = Math.trunc(startRow);
        const startColT = Math.trunc(startCol);
        const endRowT = Math.trunc(endRow);
        const endColT = Math.trunc(endCol);
        
        const subImage = new Image(endColT - startColT, endRowT - startRowT);

        Console.writeln("extractSubimage subImage width: " + subImage.width + " height: " + subImage.height);
        Console.writeln("extractSubimage startRow: " + startRowT + " startCol: " + startColT + " endRow: " + endRowT + " endCol: " + endColT);

        for (let row = startRowT; row < endRowT; row++) {
            for (let col = startColT; col < endColT; col++) {
                let locationVal = array2D.sample(col, row);

                subImage.setSample(locationVal, col - startCol, row - startRowT);
            }
        }

        return subImage;
    }

    let subImage = new Image;

    subImage = extractSubimage(maskImage, lowerBoundY, lowerBoundX, upperBoundY, upperBoundX);

    Console.writeln("subMatrix width: " + subImage.width + " height: " + subImage.height);

    var PConv = new Convolution;
    PConv.mode = Convolution.prototype.Parametric;
    PConv.sigma = 8.30;
    PConv.shape = 2.00;
    PConv.aspectRatio = 1.00;
    PConv.rotationAngle = 0.00;
    PConv.filterSource = "";
    PConv.rescaleHighPass = false;

    Console.writeln("Convolution initialized");
    PConv.executeOn(maskWindow.mainView);
    Console.writeln("Convolution executed");

    let invertedMaskWindow = new ImageWindow(selectedImage.width, selectedImage.height,
        1, // 1 channel for grayscale
        selectedImage.bitsPerSample,
        selectedImage.isReal,
        false
    );

    Console.writeln("Inverted mask window has been setup");

    let invertedMaskImageView = invertedMaskWindow.mainView;
    invertedMaskImageView.beginProcess(UndoFlag_NoSwapFile);
    let invertedMaskImage = invertedMaskImageView.image;
    invertedMaskImage.fill(1); // Initialize the inverted mask image with white (1)

    Console.writeln("Inverted mask image has been setup");
    Console.writeln("Mask image view id:" + maskImageView.id);
    Console.writeln("Inverted mask image view id:" + invertedMaskImageView.id);

    PM.expression = "max(0, combine(" + invertedMaskImageView.id + ", " + maskImageView.id + ", op_sub()))";
    
    Console.writeln("PM expression: " + PM.expression);
    PM.executeOn(invertedMaskWindow.mainView);

    let donutCorrectionFactor = medianOfRing / medianOfCircle;
    let invertedDonutCorrectionFactor = 1.0 / donutCorrectionFactor;
    Console.writeln("donutCorrectionFactor: " + donutCorrectionFactor);

    PM.expression = "" + invertedMaskImageView.id + " * " + invertedDonutCorrectionFactor + "";
    Console.writeln("PM expression: " + PM.expression);
    PM.executeOn(invertedMaskImageView);

    if (parameters.targetWindow) {
        PM.expression = "max(0, combine(" + invertedMaskImageView.id + ", " + parameters.targetWindow.mainView.id + ", op_mul()))";
        Console.writeln("PM expression: " + PM.expression);
        PM.executeOn(invertedMaskImageView);

        PM.expression = "max(0, combine(" + maskImageView.id + ", " + parameters.targetWindow.mainView.id + ", op_mul()))";
        Console.writeln("PM expression: " + PM.expression);
        PM.executeOn(maskImageView);

        PM.expression = "max(0, combine(" + maskImageView.id + ", " + invertedMaskImageView.id + ", op_add()))";
        Console.writeln("PM expression: " + PM.expression);
        PM.executeOn(invertedMaskImageView);

        PM.expression = "" + invertedMaskImageView.id + " * " + donutCorrectionFactor + "";
        Console.writeln("PM expression: " + PM.expression);
        PM.executeOn(invertedMaskImageView);
    }

    let medianMaskWindow = new ImageWindow(selectedImage.width, selectedImage.height,
        1, // 1 channel for grayscale
        selectedImage.bitsPerSample,
        selectedImage.isReal,
        false
    );

    Console.writeln("Inverted mask window has been setup");

    let medianMaskImageView = medianMaskWindow.mainView;
    medianMaskImageView.beginProcess(UndoFlag_NoSwapFile);
    let medianMaskImage = medianMaskImageView.image;
    medianMaskImage.fill(0); // Initialize the inverted mask image

    PM.expression = "" + invertedMaskImageView.id + "";
    Console.writeln("PM expression: " + PM.expression);
    PM.executeOn(medianMaskImageView);

    var Pmedconv = new Convolution;
    Pmedconv.mode = Convolution.prototype.Library;
    Pmedconv.sigma = 2.00;
    Pmedconv.shape = 2.00;
    Pmedconv.aspectRatio = 1.00;
    Pmedconv.rotationAngle = 0.00;
    Pmedconv.filterSource = "SeparableFilter {\n" +
        "   name { Box Average (7) }\n" +
        "   row-vector {  1.000000  1.000000  1.000000  1.000000  1.000000  1.000000  1.000000 }\n" +
        "   col-vector {  1.000000  1.000000  1.000000  1.000000  1.000000  1.000000  1.000000 }\n" +
        "}\n";
    Pmedconv.rescaleHighPass = false;
    Pmedconv.viewId = "";

    Console.writeln("Median convolution initialized");
    Pmedconv.executeOn(medianMaskImageView);
    Console.writeln("Median convolution executed");

    let BLEND_RING_MIN_FACTOR = 0.75;
    let BLEND_RING_MAX_FACTOR = 1.25;
    let xCenter = (x0 + x1) / 2;
    let yCenter = (y0 + y1) / 2;

    maskImage.fill(0);

    PM.expression = "iif((inellipse(" + xCenter + "," + yCenter + "," + xRadius * BLEND_RING_MAX_FACTOR + "," + yRadius * BLEND_RING_MAX_FACTOR + ") - inellipse(" + xCenter + "," + yCenter + "," + xRadius * BLEND_RING_MIN_FACTOR + "," + yRadius * BLEND_RING_MIN_FACTOR + "))>0,1,0)";
    Console.writeln("PM expression: " + PM.expression);
    PM.executeOn(maskImageView);

    let consoleCounter = 0;

    for (let row = lowerBoundY; row < upperBoundY; row++) {
        // const subRow = [];
        for (let col = lowerBoundX; col < upperBoundX; col++) {
            if (maskImageView.image.sample(col, row) > 0) {
                if (consoleCounter < 10)
                {
                    Console.writeln("x: " + col + " y: " + row);
                }

                const deltaX = col - xCenter;
                const deltaY = row - yCenter;

                let pixelAngleToCenter = Math.atan2(deltaY, deltaX);

                let xOuter = xCenter + xRadius * BLEND_RING_MAX_FACTOR * Math.cos(pixelAngleToCenter);
                let yOuter = yCenter + yRadius * BLEND_RING_MAX_FACTOR * Math.sin(pixelAngleToCenter);

                let xInner = xCenter + xRadius * BLEND_RING_MIN_FACTOR * Math.cos(pixelAngleToCenter);
                let yInner = yCenter + yRadius * BLEND_RING_MIN_FACTOR * Math.sin(pixelAngleToCenter);

                let innerPixelValue = medianMaskImageView.image.sample(xInner, yInner);
                let outerPixelValue = medianMaskImageView.image.sample(xOuter, yOuter);
                let averagePixelValue = (innerPixelValue + outerPixelValue) / 2;

                const xDiff = xInner - xOuter;
                const yDiff = yInner - yOuter;

                let ringThickness = Math.sqrt(xDiff * xDiff + yDiff * yDiff);

                const xPointDiff = col - xOuter;
                const yPointDiff = row - yOuter;

                let pointToOuterDistance = Math.sqrt(xPointDiff * xPointDiff + yPointDiff * yPointDiff);

                let ratioToInnerRing = pointToOuterDistance / ringThickness;

                let weightedAveragePixelValue = (ratioToInnerRing * innerPixelValue + (1 - ratioToInnerRing) * outerPixelValue);

                // let zeroVal = 0;
                invertedMaskImageView.image.setSample(weightedAveragePixelValue, col, row);

                if (consoleCounter < 10) {
                    Console.writeln("x: " + col + " y: " + row + " angle: " + pixelAngleToCenter + " xOut: " + xOuter + " yOut: " + yOuter + " xInn: " + xInner + " yInn: " + yInner);
                    Console.writeln("innerPixelValue: " + innerPixelValue + " outerPixelValue: " + outerPixelValue + " averagePixelValue: " + averagePixelValue);
                }

                consoleCounter++;
            }
        }
    }

    PM.expression = "" + invertedMaskImageView.id + "";
    Console.writeln("PM expression: " + PM.expression);
    PM.executeOn(parameters.targetWindow.mainView);

    Console.writeln("maskWindow executed");

    if (!maskWindow.mainView.window.isNull) maskWindow.mainView.window.forceClose();
    if (!invertedMaskWindow.mainView.window.isNull) invertedMaskWindow.mainView.window.forceClose();
    if (!medianMaskWindow.mainView.window.isNull) medianMaskWindow.mainView.window.forceClose();
    
    Console.writeln("maskWindows cleaned up");

}


DustDonutDialog.prototype.generateMaskImage = function(selectedImage) {
    console.noteln("Mask Creation Started!");
    console.flush();

    let self = this; // Store reference to 'this'

    // Check if the image is a mono image
    if (selectedImage.numberOfChannels < 3 && this.maskType === "Color") {
        (new MessageBox("Cannot create a Color Mask from a mono image.", TITLE, StdIcon_Error, StdButton_Ok)).execute();
        return;
    }

    // Create a new grayscale image with the same dimensions as the original image
    let maskWindow = new ImageWindow(selectedImage.width, selectedImage.height,
        1, // 1 channel for grayscale
        selectedImage.bitsPerSample,
        selectedImage.isReal,
        false
    );

    let maskImageView = maskWindow.mainView;
    maskImageView.beginProcess(UndoFlag_NoSwapFile);
    let maskImage = maskImageView.image;
    maskImage.fill(0); // Initialize the mask image with black (0)

    // Scale shapes according to the full-size image dimensions
    let scaleRatio = this.downsamplingFactor; // Scale factor from the preview to full-size image

    // Function to find the minimum and maximum y-coordinates in the polygon
    function findMinMaxY(polygon) {
        let minY = polygon[0][1];
        let maxY = polygon[0][1];
        for (let i = 1; i < polygon.length; i++) {
            if (polygon[i][1] < minY) minY = polygon[i][1];
            if (polygon[i][1] > maxY) maxY = polygon[i][1];
        }
        return { minY: minY, maxY: maxY };
    }

    // Function to fill a polygon using the scan-line filling algorithm
    function fillPolygon(image, polygon) {
        let { minY, maxY } = findMinMaxY(polygon);

        for (let y = minY; y <= maxY; y++) {
            if (y < 0 || y >= image.height) continue; // Skip out-of-bounds y-coordinates
            let intersections = [];
            for (let i = 0; i < polygon.length; i++) {
                let j = (i + 1) % polygon.length;
                let x1 = polygon[i][0], y1 = polygon[i][1];
                let x2 = polygon[j][0], y2 = polygon[j][1];

                if ((y1 <= y && y < y2) || (y2 <= y && y < y1)) {
                    let x = x1 + (y - y1) * (x2 - x1) / (y2 - y1);
                    intersections.push(Math.round(x));
                }
            }
            intersections.sort((a, b) => a - b);

            for (let k = 0; k < intersections.length; k += 2) {
                let xStart = Math.max(intersections[k], 0);
                let xEnd = Math.min(intersections[k + 1], image.width - 1);
                for (let x = xStart; x <= xEnd; x++) {
                    if (self.maskType === "Binary") {
                        image.setSample(1, x, y, 0); // Set the pixel to white (1) for binary mask
                    } else if (self.maskType === "Lightness") {
                        let brightness = selectedImage.sample(x, y, 0); // Get the brightness value
                        image.setSample(brightness, x, y, 0); // Set the pixel to brightness value for lightness mask
                    } else if (self.maskType === "Chrominance") {
                        if (selectedImage.numberOfChannels < 3) {
                            console.warningln("Cannot Create a Chrominance Mask of a Grey Scale Image!!!");
                            return;
                        }
                        let r = selectedImage.sample(x, y, 0);
                        let g = selectedImage.sample(x, y, 1);
                        let b = selectedImage.sample(x, y, 2);
                        let maxChannel = Math.max(r, g, b);
                        let minChannel = Math.min(r, g, b);
                        let chrominance = (maxChannel - minChannel) / maxChannel; // Calculate chrominance value
                        if (isNaN(chrominance)) chrominance = 0;
                        image.setSample(chrominance, x, y, 0); // Set the pixel to chrominance value for chrominance mask
                    } else if (self.maskType === "Color") {
                        let r = selectedImage.sample(x, y, 0);
                        let g = selectedImage.sample(x, y, 1);
                        let b = selectedImage.sample(x, y, 2);
                        let hue = Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b) * 180 / Math.PI;
                        if (hue < 0) hue += 360;
                        let { min, max } = getColorRange(self.colorDropdown.itemText(self.colorDropdown.currentItem));
                        let colorValue = (min < max)
                            ? (hue >= min && hue <= max ? 1 : 0)
                            : ((hue >= min || hue <= max) ? 1 : 0);
                        let chrominance = (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b); // Calculate chrominance value
                           sampleValue = colorValue * chrominance; // Scale color value by chrominance
                           if (isNaN(sampleValue)) sampleValue = 0; // Replace NaN with 0
                        image.setSample(sampleValue, x, y, 0); // Scale color value by chrominance
                    }
                }
            }
        }
    }

    // Fill the mask image with the appropriate values inside the user-defined shapes
    this.previewControl.shapes.forEach((shape, index) => {
        let scaledShape = shape.map(point => [point[0] * scaleRatio, point[1] * scaleRatio]);
        if (self.previewControl.shapeTypes[index] === "Brush") {
            drawBrushStrokes(maskImage, shape, self.previewControl.brushRadius, scaleRatio);
        } else if (self.previewControl.shapeTypes[index] === "SprayCan") {
            let scaledSprayCanPoints = scaleSprayCanPoints(shape, scaleRatio);
            drawSprayCanPoints(maskImage, scaledSprayCanPoints);
        } else {
            fillPolygon(maskImage, scaledShape);
        }
    });

    maskImageView.endProcess();

    // Set mask window ID based on mask type
    let maskSuffix = "";
    if (this.maskType === "Binary") {
        maskSuffix = "_bin";
    } else if (this.maskType === "Lightness") {
        maskSuffix = "_lght";
    } else if (this.maskType === "Chrominance") {
        maskSuffix = "_chrm";
    } else if (this.maskType === "Color") {
        maskSuffix = "_color";
    }

    maskImageView.id = parameters.targetWindow.mainView.id + "_DustDonut_Mask" + maskSuffix;
    maskWindow.show();

// Apply convolution to blur the mask image
var blurAmount = this.blurAmount_Slider.value;
if (blurAmount > 0) {
    var P = new Convolution;
    P.mode = Convolution.prototype.Parametric;
    P.sigma = blurAmount;
    P.executeOn(maskImageView);
} else {
    console.writeln("Skipping convolution as blurAmount is 0.");
    console.flush();
}

};


function main() {
    console.show();
    // Console.criticalln("   ____    __  _   ___       __         \n  / __/__ / /_(_) / _ | ___ / /_______ ");
    // Console.warningln(" _\\ \\/ -_) __/ / / __ |(_-</ __/ __/ _ \\ \n/___/\\__/\\__/_/ /_/ |_/__/\\__/_/  \\___/ \n                                         ");
    let dialog = new DustDonutDialog();
    dialog.execute();
}

main();
