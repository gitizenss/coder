use serde_json::Value;

use crate::config::TopologyConfig;
use crate::{config, config::ExperimentConfig, datastore::table::state::WriteState};

use super::super::*;

mod adjacency;
mod fields;

type PositionSubType = f64;
type Position = [PositionSubType; 3];

type DirectionSubType = f64;
type Direction = [DirectionSubType; 3];

pub struct Creator {}

impl Creator {
    pub fn new() -> Box<dyn PackageCreator> {
        Box::new(Creator {})
    }
}

impl PackageCreator for Creator {
    fn create(
        &self,
        config: &Arc<SimRunConfig<ExperimentRunBase>>,
        _comms: PackageComms,
    ) -> Result<Box<dyn Package>> {
        let topology = Topology {
            config: Arc::new(
                TopologyConfig::create_from_globals(&config.sim.globals)
                    .unwrap_or_else(|| TopologyConfig::default()),
            ),
        };
        Ok(Box::new(topology))
    }

    fn add_state_field_specs(
        &self,
        _config: &ExperimentConfig<ExperimentRunBase>,
        _globals: &Globals,
        field_spec_map_builder: &mut FieldSpecMapBuilder,
    ) -> Result<()> {
        fields::add_state(field_spec_map_builder)?;
        Ok(())
    }
}

pub struct Topology {
    config: Arc<config::TopologyConfig>,
}

impl Topology {
    fn topology_correction(&self, batch: &mut AgentBatch) -> Result<bool> {
        let mut ret = false;
        let (pos_dir_mut_iter, mut position_was_corrected_col) = batch.topology_mut_iter()?;
        pos_dir_mut_iter.enumerate().for_each(|(i, (pos, dir))| {
            let corrected = adjacency::correct_agent(pos, dir, &self.config);
            unsafe { position_was_corrected_col.set(i, corrected) };
            ret |= corrected;
        });
        Ok(ret)
    }
}

impl GetWorkerStartMsg for Topology {
    fn get_worker_start_msg(&self) -> Result<Value> {
        todo!()
    }
}

#[async_trait]
impl Package for Topology {
    async fn run(&mut self, state: &mut ExState, context: &Context) -> Result<()> {
        if self.config.move_wrapped_agents {
            for mut_table in state.agent_pool_mut().write_batches()? {
                if self.topology_correction(mut_table)? {
                    // TODO inplace changes and metaversioning should happen at a deeper level.
                    mut_table.metaversion.increment_batch();
                }
            }
        }
        Ok(())
    }
}
