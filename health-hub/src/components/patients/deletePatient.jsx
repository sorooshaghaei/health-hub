import React from 'react'

const deletePatient = () => {



// i shoud create this delete component and use it in all the web
// it is not created yet. only the elements are here. 

// things I should do: 
// 1) create this delete component and make sure it works everywhere
// 2) design delete confirm better!


















    const confirm = () => {
        confirmAlert({
          customUI: ({ onClose }) => {
            return (
              <>
                <div
                  style={{
                    backgroundColor: Teal,
                    border: `1px solid ${LightPink}`,
                    borderRadius: "1em",
                  }}
                  className="p-4"
                >
                  <h1 style={{ color: DarkGray }}>Delete Patient</h1>
                  <p style={{ color: DarkGray }}>
                    Are you sure, you wanna delete {patient.name}?
                  </p>
                  <button
                    onClick={() => {
                      removePatient(patientID);
                      onClose();
                    }}
                    className="btn mx-2"
                    style={{ backgroundColor: Teal }}
                  >
                    yes!
                  </button>
                  <button
                    onClick={onClose}
                    className="btn "
                    style={{ backgroundColor: Red }}
                  >
                    no!
                  </button>
                </div>
              </>
            );
          },
        });
      };
    
      const removePatient = async (patientID) => {
        try {
          setLoading(false);
          const response = await deletePatient(patientID);
          if (response) {
            const { data: patientsData } = await getAllPatients();
            setPatients(patientsData);
            setLoading(false);
          }
        } catch (error) {
          console.log(error);
          setLoading(false);
        }
      };


  return (
    <div>
        
    </div>
  )
}

export default deletePatient