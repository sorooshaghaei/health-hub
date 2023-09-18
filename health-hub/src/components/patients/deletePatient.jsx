import React from "react";
import { DarkGray, LightPink, LightRed, LightTeal } from "../../helpers/colors";
import { deletePatient } from "../../services/patientService";
import { confirmAlert } from "react-confirm-alert";

const DeletePatient = ({ patient, onDelete }) => {
  const confirmDelete = () => {
    confirmAlert({
      customUI: ({ onClose }) => {
        return (
          <div
            style={{
              backgroundColor: LightPink,
              border: `1px solid ${LightPink}`,
              borderRadius: "1em",
            }}
            className="p-4 text-center"
          >
            <h1 style={{ color: DarkGray }}>Delete Patient</h1>
            <p style={{ color: DarkGray }}>
              Are you sure you want to delete {patient.name}?
            </p>
            <button
              onClick={async () => {
                try {
                  await deletePatient(patient.id);
                  onDelete(patient.id);
                  onClose();
                } catch (error) {
                  console.log(error);
                  onClose();
                }
              }}
              className="btn mx-2"
              style={{ backgroundColor: LightRed }}
            >
              Yes!
            </button>
            <button
              onClick={onClose}
              className="btn"
              style={{ backgroundColor: LightTeal }}
            >
              No!
            </button>
          </div>
        );
      },
    });
  };

  return (
    <button
      onClick={confirmDelete}
      type="delete"
      className="btn text-white"
      style={{ backgroundColor: LightRed }}
    >
      <i className="fa fa-trash"></i> Delete Patient
    </button>
  );
};

export default DeletePatient;
