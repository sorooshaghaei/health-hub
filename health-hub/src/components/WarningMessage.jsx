import React from "react";
import { LightRed } from "../helpers/colors";

const WarningMessage = ({ message, onClose }) => {
  return (
    <div
      className="modal fade show"
      tabIndex="-1"
      role="dialog"
      style={{ display: "block" }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Warning</h5>
            <button
              type="button"
              className="close border border-0 rounded-circle"
              data-dismiss="modal"
              aria-label="Close"
              onClick={onClose}
              style={{ backgroundColor: LightRed }}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div className="modal-body">{message}</div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              data-dismiss="modal"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WarningMessage;
