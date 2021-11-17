# automatically generated by the FlatBuffers compiler, do not modify

# namespace: 

import flatbuffers
from flatbuffers.compat import import_numpy
np = import_numpy()

class UserError(object):
    __slots__ = ['_tab']

    @classmethod
    def GetRootAs(cls, buf, offset=0):
        n = flatbuffers.encode.Get(flatbuffers.packer.uoffset, buf, offset)
        x = UserError()
        x.Init(buf, n + offset)
        return x

    @classmethod
    def GetRootAsUserError(cls, buf, offset=0):
        """This method is deprecated. Please switch to GetRootAs."""
        return cls.GetRootAs(buf, offset)
    # UserError
    def Init(self, buf, pos):
        self._tab = flatbuffers.table.Table(buf, pos)

    # UserError
    def Msg(self):
        o = flatbuffers.number_types.UOffsetTFlags.py_type(self._tab.Offset(4))
        if o != 0:
            return self._tab.String(o + self._tab.Pos)
        return None

def Start(builder): builder.StartObject(1)
def UserErrorStart(builder):
    """This method is deprecated. Please switch to Start."""
    return Start(builder)
def AddMsg(builder, msg): builder.PrependUOffsetTRelativeSlot(0, flatbuffers.number_types.UOffsetTFlags.py_type(msg), 0)
def UserErrorAddMsg(builder, msg):
    """This method is deprecated. Please switch to AddMsg."""
    return AddMsg(builder, msg)
def End(builder): return builder.EndObject()
def UserErrorEnd(builder):
    """This method is deprecated. Please switch to End."""
    return End(builder)